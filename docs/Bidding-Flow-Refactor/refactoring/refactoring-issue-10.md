# Refactoring — Issue #10: Dead Code in `GET /bid-history`

> **Step 3 of the incremental refactoring plan**  
> **Risk level:** Low — no behavior change, structural cleanup only  
> **File affected:** `auction-web/src/routes/product.route.js`

---

## 1. Problem Description

`GET /bid-history/:productId` is a **JSON API route**. After the `try/catch` block that calls `res.json()` (success) or `res.status(500).json()` (error), the handler contains ~30 lines of unreachable code that:

1. References `productId` **outside its `try` block scope** → would throw `ReferenceError` if somehow reached
2. Executes two extra DB queries: `productModel.findByProductId()` and `productModel.findRelatedProducts()`
3. Builds a product viewmodel object (with a **duplicate `seller_id` key** — a latent bug)
4. Calls `res.render('vwProduct/details', { product })` — but `res` headers are already sent → would throw `"Cannot set headers after they are sent"`

This is a **leftover render-based implementation** from a prior version of the route, before it was converted to a JSON API. It was never removed, and never guarded by a condition.

---

## 2. Violated Principles

| Principle | How it is violated                                                                                         |
| :-------: | ---------------------------------------------------------------------------------------------------------- |
| **YAGNI** | ~30 lines of unused, unreachable logic add no value and will never execute                                 |
| **KISS**  | Route handler appears to have dual intent (JSON _and_ render) — misleads readers about the actual contract |
|  **SRP**  | (secondary) A JSON API route should not contain render-path code; mixing contracts blurs responsibility    |

---

## 3. Impact Analysis

| Concern             | Impact                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cognitive load**  | Developer reading the handler cannot tell at a glance whether this is a JSON or render route. They must trace execution to discover the render path is unreachable.               |
| **Latent bugs**     | The duplicate `seller_id` key in the dead viewmodel object (`Object` literal silently discards the first key) — a real bug if the code were ever re-activated.                    |
| **Scope error**     | `productId` is declared with `const` inside `try {}`. The dead code outside references it — instant `ReferenceError` if execution ever reached that point.                        |
| **Resource misuse** | `productModel.findByProductId()` and `findRelatedProducts()` are called without await in dead code — no actual DB hit, but their presence implies side effects to future readers. |
| **Test confusion**  | Any test attempting to assert the JSON response would be complicated by the apparent dual-path structure.                                                                         |

Even trivial dead code degrades **developer trust** in a file: if unused code is tolerated here, it signals that other parts of the file may also be stale or misleading.

---

## 4. Before / After

### Before (lines 906–948)

```js
router.get("/bid-history/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }
  // ── DEAD CODE BLOCK (unreachable) ───────────────────────────────────────
  const result = await productModel.findByProductId(productId); // ← productId out of scope
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = {
    thumbnail: result[0].thumbnail,
    // ... 20 more fields ...
    seller_id: result[0].seller_id, // ← defined twice (duplicate key bug)
    // ...
    seller_id: result[0].seller_id, // ← silently overwrites the first
    related_products: relatedProducts,
  };
  res.render("vwProduct/details", { product }); // ← headers already sent → crash
  // ── END DEAD CODE ────────────────────────────────────────────────────────
});
```

### After (lines 906–914)

```js
router.get("/bid-history/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }
});
```

---

## 5. Summary Table

| Metric                    |             Before              |             After              |
| ------------------------- | :-----------------------------: | :----------------------------: |
| Handler line count        |            ~42 lines            |          **9 lines**           |
| Active code paths         |            1 (JSON)             |      1 (JSON) — unchanged      |
| Dead code lines           |               ~30               |             **0**              |
| DB calls made per request |     1 (`getBiddingHistory`)     |         1 — unchanged          |
| Latent bugs               | 2 (scope error + duplicate key) |             **0**              |
| HTTP contract             |       `application/json`        | `application/json` — unchanged |
| Behavior change           |                —                |            **None**            |

---

## 6. Architectural Notes

- **No new abstraction introduced** — this is a pure deletion.
- **HTTP contract unchanged** — success/error response shape identical.
- `productModel` remains imported in the file; other routes still use it — no import removal needed.
- This cleanup is consistent with the **incremental refactoring mindset**: each step leaves the codebase strictly better with zero regression risk.
