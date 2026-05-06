<script lang="ts">
  interface Props {
    /** Optional, for future use (jump bar / analytics / A/B copy). */
    class?: string;
  }

  let { class: className }: Props = $props();
</script>

<div class={`content ${className ?? ''}`}>
  <header class="hero">
    <h2 id="help-overview-top" class="title">ShaderNoice</h2>
    <p class="tagline">Connect signals into a shader pipeline — see the result change instantly.</p>
  </header>

  <nav class="index" aria-labelledby="help-overview-index-title">
    <h3 id="help-overview-index-title" class="index-title">On this page</h3>
    <ul class="index-list">
      <li><a class="index-link" href="#help-overview-quick-start">Quick Start</a></li>
      <li><a class="index-link" href="#help-overview-connections">How connections work</a></li>
      <li><a class="index-link" href="#help-overview-paths">Choose your path</a></li>
      <li><a class="index-link" href="#help-overview-learn-more">Learn more</a></li>
    </ul>
  </nav>

  <section class="section" aria-labelledby="help-overview-quick-start">
    <div class="section-head">
      <h2 id="help-overview-quick-start" class="heading">Quick Start (first successful connection)</h2>
      <a class="backtop" href="#help-overview-top">Back to top</a>
    </div>

    <ol class="steps">
      <li>Select any node so you can see its <strong>ports</strong> (little circles).</li>
      <li>Drag from an <strong>output</strong> port → drop onto a compatible <strong>input</strong> port.</li>
      <li>If the wire won’t connect, look for a <strong>type mismatch</strong> (float vs vec2 vs color).</li>
      <li>Keep connecting until the <strong>preview changes</strong>. When it does, you’re “in the loop.”</li>
    </ol>

    <aside class="callout callout--mistake" aria-label="Common mistake">
      <h3 class="callout-title">Common mistake</h3>
      <p class="callout-copy">
        Dragging from an <strong>input</strong> to an output. Connections are always <strong>output → input</strong>.
      </p>
    </aside>
  </section>

  <section class="section" aria-labelledby="help-overview-connections">
    <div class="section-head">
      <h2 id="help-overview-connections" class="heading">How connections work</h2>
      <a class="backtop" href="#help-overview-top">Back to top</a>
    </div>

    <p class="copy">
      Every node output produces a <strong>signal</strong> (a typed value). Inputs accept specific types. If types match, the
      connection is valid.
    </p>

    <div class="diagram" role="group" aria-label="Output to input connection diagram">
      <div class="diagram-row">
        <span class="pill">Output</span>
        <span class="arrow" aria-hidden="true">→</span>
        <span class="pill">Input</span>
        <span class="meta">types must match</span>
      </div>

      <div class="diagram-row diagram-row--examples" aria-label="Type examples">
        <span class="typepill">float</span>
        <span class="typepill">vec2</span>
        <span class="typepill">vec3</span>
        <span class="typepill">color</span>
      </div>
    </div>

    <aside class="callout callout--tip" aria-label="Pro tip">
      <h3 class="callout-title">Pro tip</h3>
      <p class="callout-copy">
        When you’re stuck, simplify: connect <strong>one node at a time</strong>, then watch the preview. Small wins compound.
      </p>
    </aside>
  </section>

  <section class="section" aria-labelledby="help-overview-paths">
    <div class="section-head">
      <h2 id="help-overview-paths" class="heading">Choose your path</h2>
      <a class="backtop" href="#help-overview-top">Back to top</a>
    </div>

    <div class="details-grid" role="list">
      <details class="details" role="listitem">
        <summary class="summary">
          <span class="summary-title">Motion</span>
          <span class="summary-sub">Make something move smoothly</span>
        </summary>
        <ol class="steps">
          <li>Start from a UV-ish input, then add a node that <strong>distorts</strong> it.</li>
          <li>Feed that into a <strong>pattern/noise</strong> node to generate content.</li>
          <li>Map it into <strong>color</strong>, then connect to the output.</li>
        </ol>
      </details>

      <details class="details" role="listitem">
        <summary class="summary">
          <span class="summary-title">Audio-reactive</span>
          <span class="summary-sub">Drive a parameter from sound</span>
        </summary>
        <ol class="steps">
          <li>Add a track (upload or pick from the library).</li>
          <li><strong>Double-click a parameter port</strong> to open the signal picker.</li>
          <li>Choose a band/feature, then route it like any other signal.</li>
        </ol>
      </details>

      <details class="details" role="listitem">
        <summary class="summary">
          <span class="summary-title">Export</span>
          <span class="summary-sub">Share a still or a video</span>
        </summary>
        <ol class="steps">
          <li>Pick a view where the <strong>preview</strong> looks right.</li>
          <li>Export an <strong>image</strong> first (fast sanity check).</li>
          <li>Export a <strong>video</strong> when ready (needs WebCodecs; browser support varies).</li>
        </ol>
      </details>
    </div>
  </section>

  <section class="section" aria-labelledby="help-overview-learn-more">
    <div class="section-head">
      <h2 id="help-overview-learn-more" class="heading">Learn more</h2>
      <a class="backtop" href="#help-overview-top">Back to top</a>
    </div>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Signals</span>
        <span class="summary-sub">A few types you’ll see everywhere</span>
      </summary>
      <ul class="list">
        <li><strong>float</strong>: one number (masks, sliders, intensities).</li>
        <li><strong>vec2 / vec3</strong>: 2–3 numbers (UVs, directions, positions).</li>
        <li><strong>color</strong>: RGB (usually a vec3; plus alpha when applicable).</li>
      </ul>
    </details>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Pipeline mental model</span>
        <span class="summary-sub">A helpful flow (not a rule)</span>
      </summary>
      <p class="copy">A common flow is: start with UVs, distort them, generate content, map to color, then output.</p>
      <div class="pipeline" role="list" aria-label="Example shader pipeline">
        <div class="pill" role="listitem">UV</div>
        <div class="arrow" aria-hidden="true">→</div>
        <div class="pill" role="listitem">Distort</div>
        <div class="arrow" aria-hidden="true">→</div>
        <div class="pill" role="listitem">Content</div>
        <div class="arrow" aria-hidden="true">→</div>
        <div class="pill" role="listitem">Color</div>
        <div class="arrow" aria-hidden="true">→</div>
        <div class="pill" role="listitem">Output</div>
      </div>
    </details>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Explore & node guides</span>
        <span class="summary-sub">Learn one node at a time</span>
      </summary>
      <ul class="list">
        <li>Open the <strong>node library</strong>, add nodes, and connect until the preview changes.</li>
        <li>Browse node categories in the <strong>Docs</strong> side panel.</li>
        <li>Select <strong>one node</strong> and open <strong>Help</strong> to read its guide.</li>
      </ul>
    </details>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Timeline & automation</span>
        <span class="summary-sub">Animate parameters over time</span>
      </summary>
      <ul class="list">
        <li>Open the <strong>timeline</strong> and add a lane for a parameter.</li>
        <li>Draw a region and edit its curve to animate.</li>
        <li>Automation and audio can both drive the same scene — mix them as signals.</li>
      </ul>
    </details>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Views</span>
        <span class="summary-sub">Pick the layout you want</span>
      </summary>
      <ul class="list">
        <li><strong>Node [1]</strong>: node editor with a small preview.</li>
        <li><strong>Split [2]</strong>: editor and preview side by side.</li>
        <li><strong>Shader [3]</strong>: preview fills the viewport.</li>
      </ul>
    </details>

    <details class="details">
      <summary class="summary">
        <span class="summary-title">Move projects</span>
        <span class="summary-sub">Between devices or browsers</span>
      </summary>
      <ul class="list">
        <li>Download your project as <strong>JSON</strong>, then import it elsewhere.</li>
        <li>If your project uses uploaded audio, you may need to <strong>re-upload</strong> the audio after moving.</li>
      </ul>

      <aside class="callout callout--debug" aria-label="If nothing changes">
        <h3 class="callout-title">If nothing changes</h3>
        <ul class="callout-list">
          <li>Confirm you connected <strong>output → input</strong>.</li>
          <li>Look for a type mismatch (float/vec2/vec3/color).</li>
          <li>Try a smaller graph: one connection, then add one more.</li>
        </ul>
      </aside>
    </details>
  </section>
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--pd-xl);
    padding: var(--pd-lg);
    min-width: 0;
  }

  .hero {
    display: flex;
    flex-direction: column;
    gap: var(--pd-xs);
  }

  .title {
    margin: 0;
    font-size: var(--text-xl);
    line-height: 1.2;
  }

  .tagline {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--print-soft);
  }

  .index {
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-md);
    border: var(--frame-border);
    border-radius: var(--radius-md);
    background: var(--frame-bg);
  }

  .index-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--print-subtle);
    line-height: 1.3;
  }

  .index-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--pd-xs) var(--pd-md);
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  .index-link {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    padding: var(--pd-2xs) var(--pd-sm);
    border-radius: var(--radius-sm);
    border: var(--frame-border);
    background: var(--ghost-bg);
    color: var(--ghost-print);
    text-decoration: none;
    font-size: var(--text-xs);
    line-height: 1.2;
  }

  .index-link:hover {
    background: var(--ghost-bg-hover);
    color: var(--ghost-print-hover);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);
    min-width: 0;
    scroll-margin-top: 16px;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--pd-md);
    min-width: 0;
  }

  .heading {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--print-subtle);
    line-height: 1.3;
    min-width: 0;
  }

  .backtop {
    flex: 0 0 auto;
    font-size: var(--text-xs);
    color: var(--print-soft);
    text-decoration: none;
    padding: var(--pd-3xs) var(--pd-xs);
    border-radius: var(--radius-sm);
  }

  .backtop:hover {
    color: var(--ghost-print-hover);
    background: var(--ghost-bg-hover);
  }

  .copy {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .steps {
    margin: 0;
    padding-left: var(--pd-lg);
    font-size: var(--text-sm);
    line-height: 1.55;
    min-width: 0;
  }

  .list {
    margin: 0;
    padding-left: var(--pd-lg);
    list-style: disc;
    font-size: var(--text-sm);
    line-height: 1.55;
    min-width: 0;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--pd-sm);
    min-width: 0;
  }

  .details {
    border: var(--frame-border);
    border-radius: var(--radius-md);
    background: var(--frame-bg);
    overflow: clip;
    min-width: 0;
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--pd-2xs);
    padding: var(--pd-md);
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .summary::-webkit-details-marker {
    display: none;
  }

  .summary-title {
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
    color: var(--ghost-print);
  }

  .summary-sub {
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--print-soft);
  }

  .details > :not(summary) {
    padding: 0 var(--pd-md) var(--pd-md) var(--pd-md);
  }

  .pipeline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--pd-xs);
    padding: var(--pd-sm);
    border: var(--frame-border);
    border-radius: var(--radius-md);
    background: var(--ghost-bg);
    min-width: 0;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: var(--pd-2xs) var(--pd-sm);
    border-radius: var(--radius-sm);
    background: var(--frame-bg);
    color: var(--ghost-print);
    white-space: nowrap;
    font-size: var(--text-sm);
    line-height: 1.2;
  }

  .arrow {
    color: var(--print-soft);
    user-select: none;
  }

  .diagram {
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-md);
    border: var(--frame-border);
    border-radius: var(--radius-md);
    background: var(--frame-bg);
    min-width: 0;
  }

  .diagram-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--pd-xs);
    min-width: 0;
  }

  .diagram-row--examples {
    gap: var(--pd-xs);
  }

  .meta {
    font-size: var(--text-xs);
    color: var(--print-soft);
    white-space: nowrap;
  }

  .typepill {
    display: inline-flex;
    align-items: center;
    padding: var(--pd-3xs) var(--pd-xs);
    border-radius: var(--radius-sm);
    border: var(--frame-border);
    background: var(--ghost-bg);
    color: var(--ghost-print);
    font-size: var(--text-xs);
    line-height: 1.2;
    white-space: nowrap;
  }

  .callout {
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
    padding: var(--pd-md);
    border-radius: var(--radius-md);
    border: var(--frame-border);
    background: var(--ghost-bg);
    min-width: 0;
  }

  .callout--mistake {
    border-left: 3px solid var(--accent-border);
  }

  .callout--tip {
    border-left: 3px solid var(--accent-border);
  }

  .callout--debug {
    border-left: 3px solid var(--accent-border);
  }

  .callout-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--print-subtle);
    line-height: 1.3;
  }

  .callout-copy {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .callout-list {
    margin: 0;
    padding-left: var(--pd-lg);
    list-style: disc;
    font-size: var(--text-sm);
    line-height: 1.55;
    min-width: 0;
  }

  @media (min-width: 520px) {
    .index-list {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .details-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: start;
    }
  }
</style>

