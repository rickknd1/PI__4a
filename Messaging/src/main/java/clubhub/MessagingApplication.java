package clubhub;

import clubhub.model.Conversation;
import clubhub.model.ConversationParticipant;
import clubhub.model.Message;
import clubhub.repository.ConversationRepository;
import clubhub.repository.ConversationParticipantRepository;
import clubhub.repository.MessageRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.config.EnableMongoAuditing;


@SpringBootApplication
public class MessagingApplication {

    public static void main(String[] args) {
        SpringApplication.run(MessagingApplication.class, args);
    }


}
