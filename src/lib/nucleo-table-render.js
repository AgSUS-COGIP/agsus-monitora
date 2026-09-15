const rendered = new WeakMap();

// Compare the undecorated markup, preserving operational buttons and focus when
// the underlying records have not changed. External row replacement is detected.
export function renderNucleoTable(body, markup) {
  const previous = rendered.get(body);
  const children = [...body.children];
  if (
    previous?.markup === markup &&
    previous.children.length === children.length &&
    children.every((child, index) => child === previous.children[index])
  )
    return false;
  body.innerHTML = markup;
  rendered.set(body, { markup, children: [...body.children] });
  return true;
}
