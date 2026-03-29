package com.clubhub.treasury.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("ClubHub - Treasury Service API")
                .version("1.0.0")
                .description("Module de tresorerie : cotisations, paiements, depenses, budget, rapports")
                .contact(new Contact().name("ClubHub Team")))
            .servers(List.of(
                new Server().url("http://localhost:8082").description("Dev local"),
                new Server().url("http://treasury-service:8082").description("Docker")
            ));
    }
}
