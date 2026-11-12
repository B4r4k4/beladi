# مصادر تفاصيل الخريطة / Map detail credits

طبقة التفاصيل على خريطة التنقّل (الطرق، السكة الحديد، الأنهار) مأخوذة من بيانات
[Natural Earth](https://www.naturalearthdata.com/) بمقياس 1:10m، وهي **ملكية عامة (Public Domain)**.

| Layer | Natural Earth file |
|---|---|
| Main / minor roads (`hw`, `tr`) | `ne_10m_roads` |
| Railways (`rail`) | `ne_10m_railroads` |
| Rivers (`rivers`) | `ne_10m_rivers_lake_centerlines` |

- المدن (`cities.tsv`): قائمة منسّقة يدوياً — خط العرض، خط الطول، الأهمية (1 الأكبر)، الاسم بالعربية والإنجليزية والفرنسية.
- الإسقاط هو نفسه المستعمل في `roads` داخل `index.html`:
  `x = 218 + 54.19 × (lon − 25)` ، `y = 108 + 57.5 × (22 − lat)`، والخطوط مقصوصة على حدود الولايات في `map.shapes`.

## إعادة التوليد / Regenerating

1. نزّل ملفات GeoJSON الثلاثة من
   `https://github.com/nvkelso/natural-earth-vector/tree/master/geojson` إلى مجلد واحد.
2. `node art/map/build.js <مجلد-geojson> index.html detail.js`
3. انسخ محتوى `detail.js` مكان كتلة `detail: { … }` داخل `map` في `index.html`.

لإضافة مدينة: أضف سطراً إلى `cities.tsv` ثم أعد التوليد (أو أضفها مباشرة إلى `map.detail.cities` في `index.html`).
