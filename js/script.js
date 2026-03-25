/* ─── LOOKBOOK DRAG SCROLL ─── */
(async function () {
  const wrap = document.getElementById('lookbook-track-wrap');
  const track = document.getElementById('lookbook-track');
  const dotsContainer = document.getElementById('lookbook-dots');

  try {
    const res = await fetch('data/looks.json');
    if (!res.ok) throw new Error('Failed to fetch looks data');
    const looksData = await res.json();

    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    looksData.forEach((look, idx) => {
      // Create card
      const card = document.createElement('div');
      card.className = 'look-card';
      card.innerHTML = `
        ${look.newArrival ? `<div class="look-label">New Arrival</div>` : ''}
        <div class="look-image-wrap">
          <img src="${look.imgSrc}"
               alt="${look.imgAlt}"
               loading="lazy"
               onerror="this.src='${look.imgFallbackUrl}'">
        </div>
        <div class="look-card-body">
          <span class="look-moment">${look.moment}</span>
          <h3 class="look-title">${look.title}</h3>
          <p class="look-desc">${look.desc}</p>
          <div class="look-products">
            <div class="look-product-item">
              <span class="look-product-name">${look.productName}</span>
              <span class="look-product-price">${look.productPrice}</span>
            </div>
          </div>
        </div>
        <a href="${look.shopUrl}" class="result-cta-full" target="_blank" rel="noopener">Shop This Look</a>
      `;
      track.appendChild(card);

      // Create dot
      const dot = document.createElement('div');
      dot.className = `lookbook-dot ${idx === 0 ? 'active' : ''}`;
      dot.dataset.idx = idx;
      dotsContainer.appendChild(dot);
    });
  } catch (err) {
    console.error("Lookbook fetch error:", err);
  }

  const dots = document.querySelectorAll('.lookbook-dot');
  let isDragging = false, startX = 0, startScroll = 0;

  wrap.addEventListener('mousedown', e => {
    isDragging = true;
    wrap.classList.add('dragging');
    startX = e.pageX - wrap.offsetLeft;
    startScroll = wrap.scrollLeft;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    wrap.classList.remove('dragging');
  });

  wrap.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - wrap.offsetLeft;
    wrap.scrollLeft = startScroll - (x - startX);
  });

  // Touch
  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].pageX;
    startScroll = wrap.scrollLeft;
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    const x = e.touches[0].pageX;
    wrap.scrollLeft = startScroll - (x - startX);
  }, { passive: true });

  // Dots / Scroll Sync
  wrap.addEventListener('scroll', () => {
    const cards = track.querySelectorAll('.look-card');
    if (cards.length === 0) return;
    const scrollCenter = wrap.scrollLeft + wrap.clientWidth / 2;
    let closest = 0, minDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(scrollCenter - cardCenter);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === closest));
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const cards = track.querySelectorAll('.look-card');
      const idx = +dot.dataset.idx;
      if (cards[idx]) {
        wrap.scrollTo({ left: cards[idx].offsetLeft - 40, behavior: 'smooth' });
      }
    });
  });
})();


/* ─── AI STYLE FINDER ─── */
(async function () {

  // Fetch catalogue
  let SOY_CATALOGUE = [];
  try {
    const res = await fetch('data/catalogue.json');
    if (res.ok) SOY_CATALOGUE = await res.json();
  } catch (err) {
    console.error("Catalogue fetch error:", err);
  }

  const textarea = document.getElementById('style-input');
  const btn = document.getElementById('finder-btn');
  const loading = document.getElementById('finder-loading');
  const results = document.getElementById('finder-results');
  const grid = document.getElementById('results-grid');
  const error = document.getElementById('finder-error');
  const introTxt = document.getElementById('results-intro-text');

  const imageInput = document.getElementById('image-input');
  const imageCount = document.getElementById('image-count');

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const count = imageInput.files.length;
      if (count > 2) {
        alert("Maximum 2 images allowed.");
        imageInput.value = ""; 
        imageCount.textContent = "";
        return;
      }
      imageCount.textContent = count > 0 ? `${count} image(s) attached` : "";
    });
  }

  textarea.addEventListener('input', () => {
    btn.disabled = textarea.value.trim().length < 8;
  });

  document.querySelectorAll('.finder-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = chip.dataset.text;
      btn.disabled = false;
      textarea.focus();
    });
  });

  btn.addEventListener('click', runSearch);

  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !btn.disabled) runSearch();
  });

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function runSearch() {
    const query = textarea.value.trim();
    if (!query) return;

    btn.disabled = true;
    results.classList.remove('visible');
    error.classList.remove('visible');
    loading.classList.add('visible');

    const catalogueText = SOY_CATALOGUE.map((p, i) =>
      `${i + 1}. "${p.name}" — Tags: ${p.tags} — Price: ${p.price}`
    ).join('\n');

    const prompt = `You are a personal stylist for Shades of You (SOY), a premium D2C ethnic wear brand from India specialising in handcrafted Batik on natural fabrics.

A customer has described what they are looking for:
"${query.replace(/"/g, "'")}"

Here is the current SOY product catalogue:
${catalogueText}

Your task: Pick the 3 best-matching products from the catalogue above. For each, write one short, warm, specific sentence (max 18 words).

CRITICAL JSON RULES:
1. Respond ONLY with valid JSON.
2. DO NOT use double quotes (\") anywhere inside the text values. Use single quotes (') instead to avoid breaking the JSON format.
3. No markdown ticks, no preamble.

{
  "summary": "A warm one sentence reflection of what the customer is looking for",
  "matches": [
    { "index": 1, "reason": "Short reason using only single quotes for punctuation" },
    { "index": 2, "reason": "Another short reason" },
    { "index": 3, "reason": "Third short reason" }
  ]
}`;

    try {
      // Prepare Gemini request parts
      const parts = [{ text: prompt }];

      // Handle max 2 images
      const files = imageInput?.files ? Array.from(imageInput.files).slice(0, 2) : [];

      for (let file of files) {
        const base64 = await fileToBase64(file);
        parts.push({
          inline_data: {
            mime_type: file.type,
            data: base64
          }
        });
      }

      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": "AIzaSyBATopg-_iEfQzDqPrvzQUwF88NRwxC8S4"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: parts 
              }
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        reason: { type: "string" }
                      },
                      required: ["index", "reason"]
                    }
                  }
                },
                required: ["summary", "matches"]
              }
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          })
        }
      );

      const data = await res.json();

      if (!data.candidates) {
        throw new Error("API Error: " + JSON.stringify(data));
      }

      let raw = "";
      try {
        raw = data.candidates[0].content.parts[0].text.trim();
        const json = JSON.parse(raw.replace(/```json|```/g, '').trim());

        loading.classList.remove('visible');
        renderResults(json, query);
      } catch (parseError) {
        const finishReason = data.candidates[0].finishReason || "UNKNOWN";
        error.innerHTML = `<div style="color:#FFF;text-align:left;padding:12px;background:rgba(0,0,0,0.5);font-size:12px;border:1px solid #C4956A;word-break:break-word;"><b>JSON Parser Failed:</b> ${parseError.message}<br><b>Finish Reason:</b> ${finishReason}<br><br><b>Raw AI Output:</b><br>${String(raw).replace(/</g, "&lt;")}</div>`;
        loading.classList.remove('visible');
        error.classList.add('visible');
        btn.disabled = false;
        console.error("RAW AI OUTPUT:", raw, parseError);
        return;
      }

    } catch (err) {
      error.innerHTML = `<p>An error occurred generating your style matches. Please try again.</p>`;
      loading.classList.remove('visible');
      error.classList.add('visible');
      btn.disabled = false;
      console.error(err);
    }
  }

  function renderResults(json, query) {
    introTxt.innerHTML = `<strong>${json.summary}</strong>`;

    grid.innerHTML = json.matches.map(match => {
      const p = SOY_CATALOGUE[match.index - 1];
      if (!p) return '';
      return `
        <div class="result-card">
          <div class="result-img-wrap">
            <img src="${p.img}" alt="${p.name}" loading="lazy"
                 onerror="this.src='https://placehold.co/300x380/1a1208/7A6050?text=SOY'">
          </div>
          <div class="result-body">
            <h3 class="result-name">${p.name}</h3>
            <div class="result-price-wrap">
              ${p.original ? `<span class="result-original">${p.original}</span>` : ''}
              <span class="result-price">${p.price}</span>
            </div>
            <p class="result-reason">${match.reason}</p>
          </div>
          <a href="${p.url}" class="result-cta-full" target="_blank">View Product</a>
        </div>
      `;
    }).join('');

    results.classList.add('visible');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.disabled = false;
  }

})();