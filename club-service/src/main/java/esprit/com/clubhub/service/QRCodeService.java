package esprit.com.clubhub.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class QRCodeService {

    private static final int QR_CODE_WIDTH = 300;
    private static final int QR_CODE_HEIGHT = 300;
    private static final SecureRandom random = new SecureRandom();

    @Value("${app.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    public String generateQRToken() {
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    public String generateElectionQRCodeWithUrl(String qrToken) {
        try {
            String validationUrl = frontendUrl + "/elections/scan/" + qrToken;

            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.MARGIN, 1);

            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(validationUrl, BarcodeFormat.QR_CODE,
                                                      QR_CODE_WIDTH, QR_CODE_HEIGHT, hints);

            BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(bitMatrix);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(qrImage, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            return "data:image/png;base64," + base64Image;

        } catch (WriterException | IOException e) {
            System.err.println("Erreur génération QR Code: " + e.getMessage());
            return null;
        }
    }

    public String generateGoogleMapsLink(double latitude, double longitude) {
        return String.format("https://www.google.com/maps?q=%.6f,%.6f", latitude, longitude);
    }

    public String generateGoogleMapsLink(double latitude, double longitude, String placeName) {
        if (placeName != null && !placeName.isEmpty()) {
            return String.format("https://www.google.com/maps/search/?api=1&query=%.6f,%.6f&query_place_id=%s",
                                latitude, longitude, placeName.replace(" ", "+"));
        }
        return generateGoogleMapsLink(latitude, longitude);
    }
}
