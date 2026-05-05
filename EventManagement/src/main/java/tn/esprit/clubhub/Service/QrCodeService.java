package tn.esprit.clubhub.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class QrCodeService {

    // Clé secrète doit être au moins 32 caractères
    private static final String SECRET_KEY = "clubhub-qr-secret-key-2025-must-be-at-least-32-bytes-long-here";
    private static final Key SIGNING_KEY = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    public String generateToken(String eventId, String userId, String name, String email) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours

        String token = Jwts.builder()
                .claim("eventId", eventId)
                .claim("userId", userId)
                .claim("name", name)
                .claim("email", email)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(SIGNING_KEY, SignatureAlgorithm.HS256)
                .compact();

        log.info("Token generated successfully");
        log.debug("Token prefix: {}...", token.substring(0, Math.min(50, token.length())));
        log.debug("Token expiration: {}", expiry);

        return token;
    }

    public Map<String, String> validateToken(String token) {
        try {
            log.debug("Validating token...");

            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(SIGNING_KEY)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            log.info("Token validated successfully");
            log.debug("EventId: {}, UserId: {}, Name: {}",
                    claims.get("eventId"), claims.get("userId"), claims.get("name"));

            Map<String, String> result = new HashMap<>();
            result.put("eventId", claims.get("eventId", String.class));
            result.put("userId", claims.get("userId", String.class));
            result.put("name", claims.get("name", String.class));
            result.put("email", claims.get("email", String.class));
            return result;

        } catch (Exception e) {
            log.error("Invalid token: {}", e.getMessage());
            return null;
        }
    }

    public byte[] generateQrImage(String content) {
        try {
            log.debug("Generating QR code...");
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, 300, 300);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            log.info("QR code generated successfully");
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Error generating QR code: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate QR code", e);
        }
    }
}
