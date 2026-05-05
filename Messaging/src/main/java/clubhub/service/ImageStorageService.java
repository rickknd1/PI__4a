package clubhub.service;

import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsOperations;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;

@Service
public class ImageStorageService {

    private final GridFsTemplate gridFsTemplate;
    private final GridFsOperations gridFsOperations;

    public ImageStorageService(GridFsTemplate gridFsTemplate, GridFsOperations gridFsOperations) {
        this.gridFsTemplate = gridFsTemplate;
        this.gridFsOperations = gridFsOperations;
    }

    /**
     * Result record returned by getFile().
     */
    public record FileResult(byte[] bytes, String contentType) {}

    /**
     * Save any file to GridFS.
     * Returns the public URL path: /api/images/{id}
     */
    public String saveFile(byte[] fileBytes, String filename, String contentType) {
        String safeContentType = (contentType != null && !contentType.isBlank())
                ? contentType
                : "application/octet-stream";

        ObjectId id = gridFsTemplate.store(
                new ByteArrayInputStream(fileBytes),
                filename,
                safeContentType
        );
        return "/api/images/" + id.toHexString();
    }

    /**
     * Legacy alias kept for backward compatibility.
     */
    public String saveImage(byte[] imageBytes, String filename) {
        return saveFile(imageBytes, filename, "image/jpeg");
    }

    /**
     * Retrieve any file from GridFS by its ID.
     * Returns both the raw bytes and the original content-type.
     */
    public FileResult getFile(String fileId) {
        try {
            GridFSFile file = gridFsTemplate.findOne(
                    new Query(Criteria.where("_id").is(fileId))
            );
            if (file == null) throw new RuntimeException("File not found: " + fileId);

            byte[] bytes = gridFsOperations.getResource(file)
                    .getInputStream()
                    .readAllBytes();

            String contentType = "application/octet-stream";
            if (file.getMetadata() != null) {
                Object ct = file.getMetadata().get("_contentType");
                if (ct != null) contentType = ct.toString();
            }

            return new FileResult(bytes, contentType);
        } catch (Exception e) {
            throw new RuntimeException("Failed to retrieve file: " + fileId, e);
        }
    }

    /**
     * Legacy alias kept for backward compatibility.
     */
    public byte[] getImage(String imageId) {
        return getFile(imageId).bytes();
    }
}