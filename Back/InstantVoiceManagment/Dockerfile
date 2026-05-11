FROM docker.io/library/eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B || true
COPY src src
RUN ./mvnw clean package -DskipTests -B

FROM docker.io/library/eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar /app/app.jar
ENV SPRING_PROFILES_ACTIVE=kubernetes
EXPOSE 8082
ENTRYPOINT ["java","-jar","/app/app.jar"]
