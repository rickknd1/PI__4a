package com.example.cstore.service;

import com.example.cstore.dto.OrderRequest;
import com.example.cstore.dto.OrderItemRequest;
import com.example.cstore.entity.Order;
import com.example.cstore.entity.OrderItem;
import com.example.cstore.entity.Product;
import com.example.cstore.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductService productService;
    private final TreasuryRecettesService treasuryRecettesService;

    public List<Order> getAllOrders() {
        try {
            return orderRepository.findAll();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public Order getOrderById(String id) {
        return orderRepository.findById(id).orElse(null);
    }

    public List<Order> getOrdersByMember(String memberId) {
        try {
            return orderRepository.findByMemberId(memberId);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public Order createOrder(OrderRequest request) {
        Order order = new Order();

        String memberId = request.getMemberId();
        if (memberId == null || memberId.isEmpty()) {
            memberId = "default-member-id";
        }
        order.setMemberId(memberId);

        order.setOrderNumber("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setOrderDate(LocalDateTime.now());
        order.setStatus(Order.OrderStatus.PENDING);
        order.setShippingAddress(request.getShippingAddress());
        order.setPaymentMethod(request.getPaymentMethod());

        List<OrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (OrderItemRequest itemReq : request.getItems()) {
            Product product = productService.getProductById(itemReq.getProductId());

            OrderItem item = new OrderItem();
            item.setProductId(product.getId());
            item.setProductName(product.getName());
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(product.getPrice());
            item.setSubtotal(product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity())));

            items.add(item);
            total = total.add(item.getSubtotal());
        }

        order.setItems(items);
        order.setTotalAmount(total);
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());

        return orderRepository.save(order);
    }

    public Order updateOrderStatus(String id, Order.OrderStatus status) {
        return updateOrderStatus(id, status, null);
    }

    /**
     * Variante avec forwarding du JWT cookie : declenche l'integration Treasury
     * si la commande passe a CONFIRMED.
     */
    public Order updateOrderStatus(String id, Order.OrderStatus status, String jwtCookie) {
        Order order = getOrderById(id);
        if (order != null) {
            Order.OrderStatus previous = order.getStatus();
            order.setStatus(status);
            order.setUpdatedAt(LocalDateTime.now());
            Order saved = orderRepository.save(order);

            // Hook Treasury : on pousse la recette uniquement a la transition vers CONFIRMED
            // (evite les doublons si on rappelle PUT /status?status=CONFIRMED plusieurs fois).
            if (status == Order.OrderStatus.CONFIRMED && previous != Order.OrderStatus.CONFIRMED) {
                try {
                    treasuryRecettesService.recordOrderAsRecette(saved, jwtCookie);
                } catch (Exception e) {
                    // Silent fail : la commande est sauvegardee, Treasury sera resync manuellement si besoin
                    log.warn("Treasury hook failed for order {}: {}", saved.getOrderNumber(), e.getMessage());
                }
            }
            return saved;
        }
        return null;
    }
}
