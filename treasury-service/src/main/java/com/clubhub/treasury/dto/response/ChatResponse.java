package com.clubhub.treasury.dto.response;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatResponse {
    private String reply;
    private String source;
}
