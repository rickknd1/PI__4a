FROM docker.io/library/gradle:8.5-jdk17 AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src src
RUN gradle --no-daemon clean bootJar -x test

FROM docker.io/library/eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/app.jar
ENV SPRING_PROFILES_ACTIVE=kubernetes
EXPOSE 8087
ENTRYPOINT ["java","-jar","/app/app.jar"]
