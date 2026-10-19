# Hossa

Żywa makieta gospodarki połączona z giełdą. Miasteczko w 3D — kopalnia, huta, fabryka, port,
sieć sklepów i bank — produkuje i handluje samo, a każda z tych firm jest notowana na giełdzie
w centrum. Kursy nie są losowane: powstają w prawdziwym arkuszu zleceń, w którym boty
inwestorów reagują na to, co dzieje się na makiecie (strajk, sztorm, wyniki kwartalne,
decyzja banku centralnego).

> Projekt w budowie. Gotowy jest silnik giełdy; gospodarka, makieta i interfejs powstają
> etapami.

## Silnik giełdy (`packages/engine`)

Arkusz zleceń z kojarzeniem według ceny, a potem czasu (price-time priority) — port domeny
silnika [Parkiet](https://github.com/Sitkowski01/parkiet-exchange) z Javy do TypeScriptu,
żeby giełda działała w przeglądarce bez serwera.

- Zlecenia `LIMIT` i `MARKET`, anulowanie, głębokość arkusza, migawka.
- Zdarzenia `RESTED`, `TRADE`, `CANCELLED` — te same co w Parkiecie, co do pola.
- Ceny w groszach jako liczby całkowite, nigdy ułamki.
- Deterministyczny: ta sama sekwencja zleceń zawsze daje te same zdarzenia.
- Zero zależności — działa w Node, w przeglądarce i w Web Workerze.
- Arkusz sam waliduje każde zlecenie: w przeglądarce zlecenia przychodzą też z JSON-a i z workera,
  gdzie typy TypeScriptu już nie istnieją.

Różnice względem Parkietu, świadome:

- Maksymalna wielkość zlecenia to milion akcji, nie miliard. Java liczy na `long`, a JavaScript
  na `number`, dokładnym tylko do 2^53 — przy tym limicie obrót zlecenia zawsze jest dokładny.
- Port obejmuje kojarzenie, anulowanie, głębokość i migawkę. Odbudowy arkusza z dziennika zdarzeń
  (event sourcing po restarcie serwera) w przeglądarce nie potrzeba, więc jej nie przeniesiono.

### Jak sprawdzamy, że port jest wierny

| Test | Co sprawdza |
|---|---|
| jednostkowe | każde zachowanie arkusza osobno |
| różnicowy (fast-check) | setki losowych scenariuszy: wynik identyczny z naiwnym arkuszem, którego poprawność widać gołym okiem |
| niezmienniki (fast-check) | arkusz nigdy skrzyżowany, ilość zlecenia = transakcje + reszta, LIMIT nie handluje gorzej niż jego cena |
| zgodność z Parkietem | ~3000 poleceń nagranych z silnika w Javie (`tools/golden/GoldenVectors.java`) — port musi dać identyczne zdarzenia |
| mutacyjne (Stryker) | czy testy łapią celowo wprowadzone błędy; próg 90% |

## Uruchomienie

Wymaga Node 24 i pnpm.

```bash
pnpm install
pnpm check      # build, typy, lint, reguły architektury, testy z pokryciem
pnpm mutation   # testy mutacyjne
```

Ponowne nagranie przebiegów z Parkietu (Java 21, klasy po `./gradlew classes` w repo Parkietu):

```bash
java -cp <parkiet>/build/classes/java/main tools/golden/GoldenVectors.java \
  > packages/engine/src/test/parkiet-golden.json
```

## Licencja

MIT
