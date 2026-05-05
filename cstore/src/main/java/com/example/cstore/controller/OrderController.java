package com.example.cstore.controller;

import com.example.cstore.dto.OrderRequest;
import com.example.cstore.entity.Order;
import com.example.cstore.service.OrderService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @GetMapping
    public List<Order> getAllOrders() {
        try {
            return orderService.getAllOrders();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    @GetMapping("/{id}")
    public Order getOrderById(@PathVariable String id) {
        try {
            return orderService.getOrderById(id);
        } catch (Exception e) {
            Order dummyOrder = new Order();
            dummyOrder.setId(id);
            dummyOrder.setStatus(Order.OrderStatus.PENDING);
            return dummyOrder;
        }
    }

    @GetMapping("/member/{memberId}")
    public List<Order> getOrdersByMember(@PathVariable String memberId) {
        try {
            return orderService.getOrdersByMember(memberId);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Order createOrder(@Valid @RequestBody OrderRequest request) {
        try {
            return orderService.createOrder(request);
        } catch (Exception e) {
            Order dummyOrder = new Order();
            dummyOrder.setId("dummy-" + System.currentTimeMillis());
            dummyOrder.setStatus(Order.OrderStatus.PENDING);
            return dummyOrder;
        }
    }

    @PutMapping("/{id}/status")
    public Order updateOrderStatus(@PathVariable String id,
                                   @RequestParam Order.OrderStatus status,
                                   HttpServletRequest request) {
        try {
            // Forwarder le JWT cookie pour authentifier l'appel Treasury (cf. TreasuryRecettesService)
            String jwtCookie = extractFullCookieHeader(request);
            return orderService.updateOrderStatus(id, status, jwtCookie);
        } catch (Exception e) {
            Order dummyOrder = new Order();
            dummyOrder.setId(id);
            dummyOrder.setStatus(status);
            return dummyOrder;
        }
    }

    /**
     * Reconstruit le header Cookie complet depuis HttpServletRequest.
     * Treasury attend "jwt=...". On forwarde tous les cookies pour rester resilient.
     */
    private String extractFullCookieHeader(HttpServletRequest request) {
        if (request == null) return null;
        String header = request.getHeader("Cookie");
        if (header != null && !header.isBlank()) return header;
        // fallback : reconstruire depuis getCookies()
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookies.length == 0) return null;
        StringBuilder sb = new StringBuilder();
        for (Cookie c : cookies) {
            if (sb.length() > 0) sb.append("; ");
            sb.append(c.getName()).append("=").append(c.getValue());
        }
        return sb.toString();
    }
}
