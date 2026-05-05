package esprit.com.instantvoicemanagment.config;

import lombok.Data;

@Data
public class SignalingMessage {
    private String type;         // JOIN, LEAVE, OFFER, ANSWER, ICE, PEERS, JOINED, LEFT
    private String fromUserId;
    private String targetUserId;
    private String channelId;
    private Object data;         // SDP for OFFER/ANSWER, ICE candidate for ICE, String[] for PEERS
}
