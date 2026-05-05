package com.clubhub.treasury;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TreasuryServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TreasuryServiceApplication.class, args);
    }
}
