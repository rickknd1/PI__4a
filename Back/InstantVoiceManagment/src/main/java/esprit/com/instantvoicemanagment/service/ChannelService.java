package esprit.com.instantvoicemanagment.service;


import esprit.com.instantvoicemanagment.entity.Channel;
import esprit.com.instantvoicemanagment.repository.ChannelRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChannelService {
    private static final Set<String> VOICE_BUREAU_ROLES = Set.of(
            "BUREAU",
            "SUPER_ADMIN",
            "PRESIDENT",
            "VICE_PRESIDENT",
            "RH",
            "SECRETAIRE_GENERALE",
            "SECRETAIRE_GENERAL",
            "TRESORIER",
            "TREASURER"
    );

    private final ChannelRepo channelRepo;

    // Get channels visible to a specific user
    public List<Channel> getChannelsForUser(String userId, String role, String userCommittee) {
        String normalizedRole = role == null ? "" : role.trim().toUpperCase();
        boolean isVoiceBureau = VOICE_BUREAU_ROLES.contains(normalizedRole);
        return channelRepo.findAll().stream()
                .filter(c -> {
                    if (c.isCommitteeChannel()) {
                        // In Voice Instant, only bureau roles see all committee channels.
                        if (isVoiceBureau) return true;
                        // Simple members see only their matching committee channel
                        return userCommittee != null && userCommittee.equals(c.getName());
                    }
                    // Regular channels: public or member
                    return !c.isPrivate()
                            || c.getMemberIds() == null
                            || c.getMemberIds().isEmpty()
                            || c.getMemberIds().contains(userId);
                })
                .collect(java.util.stream.Collectors.toList());
    }

    // Get all channels (admin use)
    public List<Channel> getAllChannels() {
        return channelRepo.findAll();
    }

    // Get channel by ID
    public Channel getChannelById(String id) {
        return channelRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Channel not found: " + id));
    }

    // Create channel — MEMBRE_SIMPLE is not allowed
    public Channel createChannel(Channel channel, String creatorId, String creatorRole) {
        if ("MEMBRE_SIMPLE".equals(creatorRole)) {
            throw new RuntimeException("MEMBRE_SIMPLE cannot create channels");
        }
        channel.setCreatedBy(creatorId);
        if (creatorId != null && !channel.getMemberIds().contains(creatorId)) {
            channel.getMemberIds().add(creatorId);
        }
        return channelRepo.save(channel);
    }

    // Delete channel
    public void deleteChannel(String id) {
        channelRepo.deleteById(id);
    }

    // Add member to channel
    public Channel addMember(String channelId, String userId) {
        Channel channel = getChannelById(channelId);
        if (channel.getMemberIds() == null) {
            channel.setMemberIds(new java.util.ArrayList<>());
        }
        if (channel.getKickedMemberIds() == null) {
            channel.setKickedMemberIds(new java.util.ArrayList<>());
        }
        // Allow re-adding a previously kicked member.
        channel.getKickedMemberIds().removeIf(id -> sameUserId(id, userId));
        if (channel.getMemberIds().stream().noneMatch(id -> sameUserId(id, userId))) {
            channel.getMemberIds().add(userId);
        }
        return channelRepo.save(channel);
    }

    // Remove member from channel and mark as kicked so they aren't re-added on sync
    public Channel removeMember(String channelId, String userId) {
        Channel channel = getChannelById(channelId);
        if (channel.getMemberIds() == null) {
            channel.setMemberIds(new java.util.ArrayList<>());
        }
        if (channel.getKickedMemberIds() == null) {
            channel.setKickedMemberIds(new java.util.ArrayList<>());
        }
        // Be tolerant to legacy IDs stored with different key variants.
        channel.getMemberIds().removeIf(id -> sameUserId(id, userId));
        if (channel.getKickedMemberIds().stream().noneMatch(id -> sameUserId(id, userId))) {
            channel.getKickedMemberIds().add(userId);
        }
        return channelRepo.save(channel);
    }

    private boolean sameUserId(String left, String right) {
        if (left == null || right == null) return false;
        return left.trim().equals(right.trim());
    }

    // Remove a member from a committee channel
    public void removeFromCommitteeChannel(String committeeName, String memberId) {
        channelRepo.findByNameAndCommitteeChannel(committeeName, true).ifPresent(channel -> {
            channel.getMemberIds().remove(memberId);
            channelRepo.save(channel);
        });
    }

    // Sync: remove member from every committee channel except their current one, then add to current one
    public Channel syncMemberCommitteeChannel(String memberId, String currentCommittee) {
        channelRepo.findAll().stream()
                .filter(c -> c.isCommitteeChannel()
                        && !c.getName().equals(currentCommittee)
                        && c.getMemberIds().contains(memberId))
                .forEach(c -> {
                    c.getMemberIds().remove(memberId);
                    channelRepo.save(c);
                });
        return ensureCommitteeChannel(currentCommittee, memberId);
    }

    // Ensure a committee channel exists for the given committee name, and add the member to it
    // Skip if the member was explicitly kicked from this channel
    public Channel ensureCommitteeChannel(String committeeName, String memberId) {
        Channel channel = channelRepo.findByNameAndCommitteeChannel(committeeName, true)
                .orElseGet(() -> {
                    Channel c = new Channel();
                    c.setName(committeeName);
                    c.setCommitteeChannel(true);
                    c.setPrivate(true);
                    return channelRepo.save(c);
                });
        boolean kicked = channel.getKickedMemberIds() != null
                && channel.getKickedMemberIds().contains(memberId);
        if (!kicked && memberId != null && !memberId.isEmpty()
                && !channel.getMemberIds().contains(memberId)) {
            channel.getMemberIds().add(memberId);
            return channelRepo.save(channel);
        }
        return channel;
    }
}
