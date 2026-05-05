package tn.esprit.clubhub.Service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import net.sourceforge.tess4j.Tesseract;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;

@Service
public class DocumentParserService {

    public String extractText(MultipartFile file) throws Exception {
        String fileName = file.getOriginalFilename().toLowerCase();

        if (fileName.endsWith(".pdf")) {
            return extractFromPdf(file);
        } else if (fileName.matches(".*\\.(png|jpg|jpeg|webp)$")) {
            return extractFromImage(file);
        }
        throw new IllegalArgumentException("Unsupported file type");
    }

    private String extractFromPdf(MultipartFile file) throws Exception {
        try (PDDocument document = PDDocument.load(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String extractFromImage(MultipartFile file) throws Exception {
        Tesseract tesseract = new Tesseract();
        tesseract.setDatapath("/usr/share/tesseract-ocr/4.00/tessdata"); // Configure path
        BufferedImage image = ImageIO.read(file.getInputStream());
        return tesseract.doOCR(image);
    }
}