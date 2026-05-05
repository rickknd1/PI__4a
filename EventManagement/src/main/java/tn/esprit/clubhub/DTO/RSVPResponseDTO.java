package tn.esprit.clubhub.DTO;

import java.time.LocalDateTime;

public class RSVPResponseDTO {
    private boolean success;
    private String message;
    private String eventId;
    private String eventTitle;
    private String userName;
    private String userEmail;
    private String qrToken;
    private String qrUrl;
    private LocalDateTime rsvpDate;
    private int currentParticipantCount;
    private int remainingSpots;
    private boolean eventFull;

    // Constructors
    public RSVPResponseDTO() {}

    // Getters and Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getQrToken() { return qrToken; }
    public void setQrToken(String qrToken) { this.qrToken = qrToken; }

    public String getQrUrl() { return qrUrl; }
    public void setQrUrl(String qrUrl) { this.qrUrl = qrUrl; }

    public LocalDateTime getRsvpDate() { return rsvpDate; }
    public void setRsvpDate(LocalDateTime rsvpDate) { this.rsvpDate = rsvpDate; }

    public int getCurrentParticipantCount() { return currentParticipantCount; }
    public void setCurrentParticipantCount(int currentParticipantCount) { this.currentParticipantCount = currentParticipantCount; }

    public int getRemainingSpots() { return remainingSpots; }
    public void setRemainingSpots(int remainingSpots) { this.remainingSpots = remainingSpots; }

    public boolean isEventFull() { return eventFull; }
    public void setEventFull(boolean eventFull) { this.eventFull = eventFull; }
}