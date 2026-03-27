# 🎨 Airflow Icons - Visual Guide

## Where Icons Appear

### 1. Server Management Panels

#### Add New Server
```
┌─────────────────────────────────────┐
│ [🔷] ➕ Add New Server              │
│                                     │
│ Server Configuration                │
│ ...                                 │
└─────────────────────────────────────┘
```

#### Server Details
```
┌─────────────────────────────────────┐
│ [🔷] My Airflow Server              │
│ Self-hosted Airflow • http://...    │
│                                     │
│ [Edit] [Delete]                     │
│                                     │
│ Health Status                       │
│ ...                                 │
└─────────────────────────────────────┘
```

#### Edit Server
```
┌─────────────────────────────────────┐
│ [🔷] ✏️ Edit Server                 │
│                                     │
│ Server Configuration                │
│ ...                                 │
└─────────────────────────────────────┘
```

### 2. DAG Management Panel

#### DAG Details
```
┌─────────────────────────────────────┐
│ [🔷] 📊 my_dag_id                   │
│                                     │
│ [▶ Trigger] [⏸ Pause] [📄 Source]  │
│                                     │
│ Status: Active                      │
│ Owner: airflow                      │
│ ...                                 │
└─────────────────────────────────────┘
```

### 3. Admin Panels

#### Variables
```
┌─────────────────────────────────────┐
│ [🔷] Variables                      │
│                                     │
│ [Create] [🔄 Refresh]               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Key    │ Value    │ Actions    │ │
│ │ var1   │ value1   │ [Edit][Del]│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Pools
```
┌─────────────────────────────────────┐
│ [🔷] Pools                          │
│                                     │
│ [Create] [🔄 Refresh]               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Name   │ Slots │ Actions       │ │
│ │ pool1  │ 10    │ [Edit][Del]   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Connections
```
┌─────────────────────────────────────┐
│ [🔷] Connections                    │
│                                     │
│ [Create] [🔄 Refresh]               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ID     │ Type  │ Actions       │ │
│ │ conn1  │ http  │ [Edit][Del]   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Config
```
┌─────────────────────────────────────┐
│ [🔷] Airflow Configuration          │
│                                     │
│ [🔄 Refresh]                        │
│                                     │
│ {                                   │
│   "sections": [...]                 │
│ }                                   │
└─────────────────────────────────────┘
```

#### Plugins
```
┌─────────────────────────────────────┐
│ [🔷] Plugins (5)                    │
│                                     │
│ [🔄 Refresh]                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Name   │ Hooks │ Executors     │ │
│ │ plugin1│ ...   │ ...           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Providers
```
┌─────────────────────────────────────┐
│ [🔷] Providers (15)                 │
│                                     │
│ [🔄 Refresh]                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Package    │ Version │ Desc     │ │
│ │ apache-... │ 1.0.0   │ ...      │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Icon Legend

- **[🔷]** = Airflow logo (blue layered icon)
- Appears at the start of every panel header
- Consistent size and color across all panels
- Provides instant visual recognition

## Icon Specifications

### SVG Code
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M12 2L2 7L12 12L22 7L12 2Z" 
        fill="#017CEE" stroke="#017CEE" stroke-width="2"/>
  <path d="M2 17L12 22L22 17" 
        stroke="#017CEE" stroke-width="2" stroke-linecap="round"/>
  <path d="M2 12L12 17L22 12" 
        stroke="#017CEE" stroke-width="2" stroke-linecap="round"/>
</svg>
```

### Sizes Used
- **24x24px**: Server panels (larger headers)
- **20x20px**: Admin panels (standard headers)
- **18x18px**: DAG panel (compact header)

### Color
- **Primary**: #017CEE (Airflow blue)
- Matches official Airflow branding

### Alignment
- Vertically centered with text
- 6-8px margin-right for spacing
- Uses flexbox for perfect alignment

## CSS Implementation

```css
h1, h2 {
  display: flex;
  align-items: center;
}

h1 svg, h2 svg {
  margin-right: 6px;
}
```

## Benefits

✅ **Brand Recognition**: Instant identification as Airflow extension
✅ **Visual Consistency**: Same icon across all panels
✅ **Professional Look**: Polished, branded interface
✅ **User Experience**: Clear visual hierarchy
✅ **Marketplace Ready**: Professional appearance for publication

## Testing Checklist

- [ ] Add Server panel shows icon
- [ ] Server Details panel shows icon
- [ ] Edit Server panel shows icon
- [ ] DAG Details panel shows icon
- [ ] Variables panel shows icon
- [ ] Pools panel shows icon
- [ ] Connections panel shows icon
- [ ] Config panel shows icon
- [ ] Plugins panel shows icon
- [ ] Providers panel shows icon
- [ ] Icons are properly aligned
- [ ] Icons are correct size
- [ ] Icons are correct color

---

**All panels now feature the Airflow logo for consistent branding! 🎉**
