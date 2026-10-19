import io.github.sitkowski01.exchange.domain.BookEvent;
import io.github.sitkowski01.exchange.domain.OrderBook;
import io.github.sitkowski01.exchange.domain.OrderRequest;
import io.github.sitkowski01.exchange.domain.Side;

import java.util.ArrayList;
import java.util.List;
import java.util.SplittableRandom;

/**
 * Wzorcowe przebiegi z prawdziwego silnika Parkietu (Java) dla testu zgodnosci portu w TypeScripcie.
 *
 * Losuje scenariusze zlecen i anulowan, puszcza je przez OrderBook z Parkietu i wypisuje JSON:
 * polecenie i zdarzenia, ktore Parkiet na nie odpowiedzial. Test w packages/engine odtwarza
 * te same polecenia i wymaga identycznych zdarzen.
 *
 * Uruchomienie (klasy Parkietu po `./gradlew classes`, Java 21, bez kompilacji tego pliku):
 *   java -cp <parkiet>/build/classes/java/main tools/golden/GoldenVectors.java > packages/engine/src/test/parkiet-golden.json
 */
public final class GoldenVectors {

    private static final int SCENARIOS = 12;
    private static final int COMMANDS = 250;

    public static void main(String[] args) {
        StringBuilder out = new StringBuilder("[\n");
        for (int s = 0; s < SCENARIOS; s++) {
            SplittableRandom rnd = new SplittableRandom(1000 + s);
            OrderBook book = new OrderBook();
            List<String> steps = new ArrayList<>();
            long id = 0;
            for (int c = 0; c < COMMANDS; c++) {
                if (id > 0 && rnd.nextInt(6) == 0) {
                    // cel z calego zakresu, takze numer z luki albo juz zrealizowany — wtedy brak zdarzenia
                    long target = 1 + rnd.nextLong(id);
                    String events = book.cancel(target).map(e -> "[" + json(e) + "]").orElse("[]");
                    steps.add("{\"op\":\"cancel\",\"id\":" + target + ",\"events\":" + events + top(book) + "}");
                    continue;
                }
                id += 1 + rnd.nextInt(3); // numery rosna, ale z lukami — jak po odrzuconych zleceniach
                Side side = rnd.nextBoolean() ? Side.BUY : Side.SELL;
                long qty = 1 + rnd.nextInt(30);
                OrderRequest order = rnd.nextInt(5) == 0
                        ? OrderRequest.market(id, side, qty)
                        : OrderRequest.limit(id, side, 9_900 + rnd.nextInt(21) * 10L, qty);
                List<String> events = book.submit(order).stream().map(GoldenVectors::json).toList();
                steps.add("{\"op\":\"order\",\"id\":" + id + ",\"side\":\"" + side + "\",\"type\":\"" + order.type()
                        + "\",\"price\":" + order.price() + ",\"quantity\":" + qty + ",\"events\":[" + String.join(",", events) + "]"
                        + top(book) + "}");
            }
            // na koniec pelny stan arkusza: migawka (kolejnosc priorytetu) i glebokosc obu stron
            String end = "{\"lastOrderId\":" + book.lastOrderId()
                    + ",\"snapshot\":[" + String.join(",", book.snapshot().orders().stream().map(GoldenVectors::json).toList()) + "]"
                    + ",\"buy\":" + depth(book, Side.BUY) + ",\"sell\":" + depth(book, Side.SELL) + "}";
            // jeden scenariusz = jedna linia: plik generowany nie zalewa diffa tysiacami linii
            out.append("{\"steps\":[").append(String.join(",", steps)).append("],\"end\":").append(end).append("}")
                    .append(s < SCENARIOS - 1 ? ",\n" : "\n");
        }
        System.out.print(out.append("]\n"));
    }

    /** Najlepsze ceny po kroku; brak strony = null. */
    private static String top(OrderBook book) {
        String bid = book.bestBid().isPresent() ? String.valueOf(book.bestBid().getAsLong()) : "null";
        String ask = book.bestAsk().isPresent() ? String.valueOf(book.bestAsk().getAsLong()) : "null";
        return ",\"bid\":" + bid + ",\"ask\":" + ask;
    }

    private static String depth(OrderBook book, Side side) {
        return "[" + String.join(",", book.depth(side, 1000).stream()
                .map(l -> "{\"price\":" + l.price() + ",\"quantity\":" + l.quantity() + ",\"orders\":" + l.orders() + "}")
                .toList()) + "]";
    }

    private static String json(BookEvent event) {
        return switch (event) {
            case BookEvent.OrderRested r -> "{\"kind\":\"RESTED\",\"orderId\":" + r.orderId() + ",\"side\":\"" + r.side()
                    + "\",\"price\":" + r.price() + ",\"quantity\":" + r.quantity() + "}";
            case BookEvent.Trade t -> "{\"kind\":\"TRADE\",\"makerOrderId\":" + t.makerOrderId() + ",\"takerOrderId\":"
                    + t.takerOrderId() + ",\"takerSide\":\"" + t.takerSide() + "\",\"price\":" + t.price()
                    + ",\"quantity\":" + t.quantity() + "}";
            case BookEvent.OrderCancelled c -> "{\"kind\":\"CANCELLED\",\"orderId\":" + c.orderId() + ",\"quantity\":"
                    + c.quantity() + ",\"reason\":\"" + c.reason() + "\"}";
        };
    }
}
