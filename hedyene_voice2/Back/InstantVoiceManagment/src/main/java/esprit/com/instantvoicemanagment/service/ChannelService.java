package esprit.com.instantvoicemanagment.service;


import esprit.com.instantvoicemanagment.entity.Channel;
import esprit.com.instantvoicemanagment.repository.ChannelRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChannelService {

    private final ChannelRepo channelRepo;

    // Get channels visible to a specific user
    public List<Channel> getChannelsForUser(String userId, String role, String userCommittee) {
        return channelRepo.findAll().stream()
                .filter(c -> {
                    if (c.isCommitteeChannel()) {
                        // Non-simple members see ALL committee channels
                        if (!"MEMBRE_SIMPLE".equals(role)) return true;
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
        if (channel == null) {
            throw new RuntimeException("Channel payload is missing");
        }
        if (channel.getName() == null || channel.getName().isBlank()) {
            throw new RuntimeException("Channel name is required");
        }
        if ("MEMBRE_SIMPLE".equals(creatorRole)) {
            throw new RuntimeException("MEMBRE_SIMPLE cannot create channels");
        }
        if (channel.getMemberIds() == null) {
            channel.setMemberIds(new ArrayList<>());
        }
        if (channel.getKickedMemberIds() == null) {
            channel.setKickedMemberIds(new ArrayList<>());
        }
        channel.setCreatedBy(creatorId);
        if (creatorId != null && !creatorId.isBlank() && !channel.getMemberIds().contains(creatorId)) {
            channel.getMemberIds().add(creatorId);
        }
        log.info("Creating channel name='{}' private={} creatorId={} role={} members={}",
                channel.getName(), channel.isPrivate(), creatorId, creatorRole, channel.getMemberIds().size());
        return channelRepo.save(channel);
    }

    // Delete channel
    public void deleteChannel(String id) {
        channelRepo.deleteById(id);
    }

    // Add member to channel
    public Channel addMember(String channelId, String userId) {
        Channel channel = getChannelById(channelId);
        if (!channel.getMemberIds().contains(userId)) {
            channel.getMemberIds().add(userId);
        }
        return channelRepo.save(channel);
    }

    // Remove member from channel and mark as kicked so they aren't re-added on sync
    public Channel removeMember(String channelId, String userId) {
        Channel channel = getChannelById(channelId);
        channel.getMemberIds().remove(userId);
        if (!channel.getKickedMemberIds().contains(userId)) {
            channel.getKickedMemberIds().add(userId);
        }
        return channelRepo.save(channel);
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
