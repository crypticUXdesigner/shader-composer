<script lang="ts">
  import Input from '../input/Input.svelte';

  interface Props {
    value?: string | number;
    placeholder?: string;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
    [key: string]: unknown;
  }

  let {
    value = '',
    placeholder = '',
    class: className = '',
    oninput,
    onchange,
    onfocus,
    onblur,
    ...restProps
  }: Props = $props();
</script>

<div class="menu-input-wrapper">
  <Input
    class="menu-input {className}"
    {value}
    {placeholder}
    {oninput}
    {onchange}
    {onfocus}
    {onblur}
    {...restProps}
  />
</div>
<style>
  .menu-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--pd-xs);
  }
</style>