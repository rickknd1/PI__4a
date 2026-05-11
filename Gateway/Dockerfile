# --- Stage 1: Build ---
FROM docker.io/library/eclipse-temurin:17-jdk AS build
WORKDIR /app

# Copy Maven wrapper and pom first (cache layer)
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn

# Pre-fetch dependencies to leverage Docker layer cache
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B || true

# Copy source and build the jar
COPY src src
RUN ./mvnw clean package -DskipTests -B

# --- Stage 2: Runtime ---
FROM docker.io/library/eclipse-temurin:17-jre
WORKDIR /app

# Copy the fat jar from the builder
COPY --from=build /app/target/*.jar /app/gateway.jar

# Default Spring profile is "kubernetes" so application-kubernetes.properties wins.
ENV SPRING_PROFILES_ACTIVE=kubernetes

EXPOSE 8084

ENTRYPOINT ["java","-jar","/app/gateway.jar"]
