package tn.esprit.virtual_event_management.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class ProfanityCheckService {

    public boolean containsProfanity(String inputText) {
        try {
            if (inputText == null || inputText.isBlank()) {
                return false;
            }

            String encodedText = URLEncoder.encode(inputText, StandardCharsets.UTF_8);
            String urlString = "https://www.purgomalum.com/service/containsprofanity?text=" + encodedText;

            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            BufferedReader in = new BufferedReader(
                    new InputStreamReader(connection.getInputStream())
            );

            String inputLine;
            StringBuilder response = new StringBuilder();

            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }

            in.close();

            return response.toString().equalsIgnoreCase("true");

        } catch (Exception e) {
            System.out.println("⚠️ Profanity API error: " + e.getMessage());
            return false;
        }
    }
}