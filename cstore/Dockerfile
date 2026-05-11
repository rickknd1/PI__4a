FROM docker.io/library/eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY build.gradle settings.gradle gradlew ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies || true
COPY src src
RUN ./gradlew --no-daemon clean bootJar -x test

FROM docker.io/library/eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/app.jar
ENV SPRING_PROFILES_ACTIVE=kubernetes
EXPOSE 8087
ENTRYPOINT ["java","-jar","/app/app.jar"]
