# Decision visualization shapes

Read this only when data relationships are materially clearer as a visual.

Every chart needs `summary`. Facet renders direct labels and an accessible table automatically; do not encode meaning by color alone.

## Weighted scorecard

```json
{"kind":"scorecard","summary":"Cloud leads because cross-device access is mandatory.","options":["Local","Cloud"],"rows":[["Cross-device",1,5],["Privacy",5,3]],"max":5}
```

## Risk matrix

```json
{"kind":"risk-matrix","summary":"Account compromise has the highest impact.","items":[{"label":"Device loss","likelihood":3,"impact":4}]}
```

Likelihood and impact use 1–5 scales.

## Token waterfall

```json
{"kind":"token-waterfall","summary":"Digest reuse reduces repeated context.","items":[["Initial intent",420],["Digest reuse",-260]]}
```

Positive values are costs; negative values are savings. Prefer a normal table for exact lookup, a timeline for ordered milestones, and a dependency node for source-to-outcome relationships.
