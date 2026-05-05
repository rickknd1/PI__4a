package tn.esprit.clubhub.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Dedicated thread pool for outgoing email. Gmail's SMTP handshake can
 * take several hundred ms (and more when STARTTLS negotiation stalls);
 * running it on Tomcat's request thread makes RSVP responses feel
 * sluggish and — worse — couples the HTTP 200 to the SMTP 250.
 *
 * With a small, bounded pool we keep back-pressure explicit: if SMTP is
 * down, tasks queue up to 500 deep and then the `CallerRunsPolicy` makes
 * the caller block (preferable to silently dropping mails).
 */
@Configuration
@EnableAsync
public class AsyncMailConfig {

    @Bean(name = "mailExecutor")
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(2);
        exec.setMaxPoolSize(4);
        exec.setQueueCapacity(500);
        exec.setThreadNamePrefix("mail-");
        exec.initialize();
        return exec;
    }
}
