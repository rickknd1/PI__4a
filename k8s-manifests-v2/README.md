# ClubHub Manifests v2 — Architecture 2 pods/service

## Architecture

- 1 namespace `clubhub`
- 4 microservices métier, chacun avec **2 pods séparés** :
  - **app pod** (Deployment, Spring Boot, scalable via HPA)
  - **db pod** (StatefulSet, MongoDB, hostPath storage)
- 1 Gateway Spring Cloud (entrypoint API)
- 1 Frontend Angular (statique nginx)
- 1 Ingress nginx (entrypoint Internet)
- NetworkPolicies zero-trust
- ServiceAccount + RBAC minimal

## Communication

```
Internet → cloudflared tunnel → NodePort 30082 → ingress-nginx →
  ├── /api/* → gateway:8084 → {user-app, club-app, event-app, messaging-app}
  │                            ↓
  │                          mongo-db (StatefulSet, hostPath)
  └── /*     → frontend:80 (Angular)
```

## Ordre d'application

```bash
# 0. Namespace
kubectl apply -f 00-namespace.yaml

# 1. Config + secrets
kubectl apply -f 01-configmap.yaml
kubectl apply -f 02-secrets.yaml

# 2. RBAC
kubectl apply -f 71-rbac.yaml

# 3. Databases (StatefulSets) — déployer en premier pour readiness
kubectl apply -f 10-user-db.yaml
kubectl apply -f 20-club-db.yaml
kubectl apply -f 30-event-db.yaml
kubectl apply -f 40-messaging-db.yaml

# 4. Apps backend
kubectl apply -f 11-user-app.yaml
kubectl apply -f 21-club-app.yaml
kubectl apply -f 31-event-app.yaml
kubectl apply -f 41-messaging-app.yaml

# 5. Gateway + Frontend
kubectl apply -f 50-gateway.yaml
kubectl apply -f 51-frontend.yaml

# 6. Ingress
kubectl apply -f 60-ingress.yaml

# 7. HPA
kubectl apply -f 80-hpa.yaml

# 8. NetworkPolicies (en dernier pour éviter de bloquer le déploiement)
kubectl apply -f 70-networkpolicy.yaml
```

## Images Docker Hub utilisées

- `docker.io/rickknd/clubhub-frontend:v1`
- `docker.io/rickknd/clubhub-gateway:v1`
- `docker.io/rickknd/clubhub-user:v1`
- `docker.io/rickknd/clubhub-club:v1`
- `docker.io/rickknd/clubhub-event:v1`
- `docker.io/rickknd/clubhub-messaging:v1`
- `docker.io/library/mongo:7` (base officielle)

## Prérequis sur les nodes K8s

- Dossier `/mnt/worker-storage/` créé sur k8s-worker-1 avec permissions lecture/écriture
- worker-1 doit avoir les sous-dossiers : `user-db/`, `club-db/`, `event-db/`, `messaging-db/`
