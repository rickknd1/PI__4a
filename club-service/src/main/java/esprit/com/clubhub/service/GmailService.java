package esprit.com.clubhub.service;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.Message;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.*;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.Base64;

@Service
public class GmailService {

    private static final String APPLICATION_NAME = "ClubHub";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String TOKENS_DIRECTORY_PATH = "tokens";
    private static final List<String> SCOPES = Collections.singletonList(GmailScopes.GMAIL_SEND);

    @Value("${gmail.credentials.file:credentials.json}")
    private String credentialsFilePath;

    @Value("${gmail.user.email}")
    private String userEmail;

    private Gmail gmailService;

    @PostConstruct
    public void init() {
        new Thread(() -> {
            try {
                System.out.println("🔧 Initialisation du service Gmail (asynchrone)...");
                final NetHttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
                gmailService = new Gmail.Builder(HTTP_TRANSPORT, JSON_FACTORY, getCredentials(HTTP_TRANSPORT))
                        .setApplicationName(APPLICATION_NAME)
                        .build();
                System.out.println("✅ Service Gmail initialisé avec succès");
            } catch (Exception e) {
                System.err.println("❌ Erreur lors de l'initialisation du service Gmail: " + e.getMessage());
                System.err.println("⚠️ L'application continuera de fonctionner mais les emails ne seront pas envoyés");
                e.printStackTrace();
            }
        }, "Gmail-Init-Thread").start();

        System.out.println("✅ Application démarrée - Service Gmail s'initialise en arrière-plan");
    }

    private InputStream findCredentialsFile() {
        System.out.println("🔍 Recherche du fichier credentials.json...");

        InputStream inputStream = getClass().getResourceAsStream("/credentials.json");
        if (inputStream != null) {
            System.out.println("   ✅ Fichier trouvé dans le classpath");
            return inputStream;
        }

        File file = new File("src/main/resources/credentials.json");
        if (file.exists()) {
            try {
                System.out.println("   ✅ Fichier trouvé: " + file.getAbsolutePath());
                return new FileInputStream(file);
            } catch (FileNotFoundException e) {
                System.err.println("   ⚠️ Erreur lecture: " + e.getMessage());
            }
        }

        file = new File("credentials.json");
        if (file.exists()) {
            try {
                System.out.println("   ✅ Fichier trouvé: " + file.getAbsolutePath());
                return new FileInputStream(file);
            } catch (FileNotFoundException e) {
                System.err.println("   ⚠️ Erreur lecture: " + e.getMessage());
            }
        }

        System.err.println("   ❌ Fichier non trouvé");
        return null;
    }

    private Credential getCredentials(final NetHttpTransport HTTP_TRANSPORT) throws IOException {
        InputStream in = findCredentialsFile();

        if (in == null) {
            throw new FileNotFoundException(
                "❌ Fichier credentials.json non trouvé\n" +
                "📝 Placez votre fichier credentials.json dans src/main/resources/"
            );
        }

        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(JSON_FACTORY, new InputStreamReader(in));

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                HTTP_TRANSPORT, JSON_FACTORY, clientSecrets, SCOPES)
                .setDataStoreFactory(new FileDataStoreFactory(Paths.get(TOKENS_DIRECTORY_PATH).toFile()))
                .setAccessType("offline")
                .build();

        LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(9999).build();

        Credential credential = new AuthorizationCodeInstalledApp(flow, receiver).authorize("user");

        System.out.println("✅ Token OAuth2 obtenu et sauvegardé");
        return credential;
    }

    public void sendEmail(String to, String subject, String htmlContent) throws Exception {
        if (gmailService == null) {
            System.err.println("⚠️ Service Gmail non initialisé - Email non envoyé");
            System.err.println("   À: " + to);
            System.err.println("   Sujet: " + subject);
            return;
        }

        System.out.println("📧 Envoi email via Gmail API:");
        System.out.println("   De: " + userEmail);
        System.out.println("   À: " + to);
        System.out.println("   Sujet: " + subject);

        try {
            Properties props = new Properties();
            Session session = Session.getDefaultInstance(props, null);
            MimeMessage email = new MimeMessage(session);

            email.setFrom(new InternetAddress(userEmail));
            email.addRecipient(jakarta.mail.Message.RecipientType.TO, new InternetAddress(to));
            email.setSubject(subject);
            email.setContent(htmlContent, "text/html; charset=utf-8");

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            email.writeTo(buffer);
            byte[] bytes = buffer.toByteArray();
            String encodedEmail = Base64.getUrlEncoder().encodeToString(bytes);

            Message message = new Message();
            message.setRaw(encodedEmail);

            message = gmailService.users().messages().send("me", message).execute();

            System.out.println("   ✅ Email envoyé avec succès (ID: " + message.getId() + ")");

        } catch (Exception e) {
            System.err.println("   ❌ Erreur lors de l'envoi: " + e.getMessage());
            throw e;
        }
    }

    public boolean isInitialized() {
        return gmailService != null;
    }
}
