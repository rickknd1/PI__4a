package clubhub.controller;   // or create a dto package

import clubhub.model.Reaction;

import java.util.List;

public class ReactionUpdateMessage {
    private String messageId;
    private List<Reaction> reactions;

    public ReactionUpdateMessage(String messageId, List<Reaction> reactions) {
        this.messageId = messageId;
        this.reactions = reactions;
    }

    // Getters
    public String getMessageId() { return messageId; }
    public List<Reaction> getReactions() { return reactions; }
}