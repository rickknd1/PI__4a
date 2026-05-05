package tn.esprit.virtual_event_management;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class VirtualEventManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(VirtualEventManagementApplication.class, args);
    }

}
