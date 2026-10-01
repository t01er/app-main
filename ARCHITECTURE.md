# Gas Cylinder Delivery — Architecture Notes

## Navigation

```
RootNavigator (auth gate)
├─ SignIn                                   (unauthenticated)
└─ Main → MainTabNavigator (bottom tabs)     (authenticated)
   ├─ 🏠 Home              HomeScreen (dashboard, flat — no nested stack needed)
   ├─ 🚚 Entregas (Orders) OrdersStackNavigator
   │    ├─ OrdersList                       (push)
   │    ├─ OrderDetail                      (push, slide from right)
   │    ├─ DeliveryConfirmation             (MODAL)
   │    └─ ReportFailure                    (MODAL)
   ├─ 📦 Inventario        InventoryStackNavigator
   │    ├─ InventoryHome                    (push)
   │    ├─ RegisterMovement                 (MODAL)
   │    └─ EndOfDayReconciliation           (push, slide from right)
   └─ 👤 Perfil            ProfileScreen (flat)
```

**Why nested stacks per tab, with modals for single-task screens:** a driver
flips between tabs constantly mid-route (checking inventory, then back to
the next stop). Nested stacks preserve each tab's scroll position and back
history independently. Delivery Confirmation and Report Failure are
presented as **modals** on top of the Orders stack — a modal makes it
visually obvious "finish this one task and you're back," which matters when
a call or a wrong tap interrupts a confirmation in progress. Register
Movement modals the same way for the same reason. Everything else is a
normal push so the hardware/swipe back gesture works as expected.

The Orders tab icon carries a live badge with the pending+in-route count.

## Data layer (backend not built yet)

```
services/
├── types/            order.types.ts, inventory.types.ts   ← the future API contract
├── mocks/mockData.ts ← in-memory fake DB (orders, load, stock, movements)
└── api/
    ├── order.service.ts       ← mock now, real HTTP later
    └── inventory.service.ts   ← mock now, real HTTP later
store/
├── useOrderStore.ts    ← zustand; screens read from here, never from services directly
└── useInventoryStore.ts
```

Each mock service method (`getOrders`, `confirmDelivery`, `registerMovement`,
etc.) has the **exact signature** a real service will need. `mockData.ts` is
a tiny in-memory database — movements actually mutate stock, confirming a
delivery actually flips status — so every screen behaves like it will
against the real API. Swapping to production later means:

1. Implement the real endpoints (placeholders already added to
   `config/api.config.ts` under `DELIVERY_*` / `INVENTORY_*`).
2. Replace the bodies in `order.service.ts` / `inventory.service.ts` with
   `httpClient.get/post` calls.
3. Delete `services/mocks/mockData.ts`.
4. **No screen changes.** They only ever talk to the zustand stores.






