export const ITEM_TYPE = "notible.library.item";
export const KINDS = ["book", "film", "series", "game", "other"];
export const STATUSES = ["wishlist", "in-progress", "done", "dropped"];
// I18N (Hive #28): labels built from KINDS/STATUSES and the layout table reach
// t() as variables; tr() only lists them for scripts/plugin-locale-check.mjs.
const tr = (key) => key;
void [tr("Book"), tr("Film"), tr("Series"), tr("Game"), tr("Other"), tr("Wishlist"), tr("In progress"), tr("Done"), tr("Dropped"), tr("Grid"), tr("List")];
const MEDIA = /^media\/[0-9a-f-]{36}\.(png|jpg|jpeg|gif|webp|bmp)$/;
const emptyDocument = () => JSON.stringify({ type: "doc", content: [] });
const parseProps = (item) => { try { return JSON.parse(item?.props || "{}"); } catch { return {}; } };
export const clampRating = (value) => { const rating = Math.round(Number(value)); return Number.isFinite(rating) && rating >= 1 ? Math.min(5, rating) : 0; };
export const stars = (value) => "★".repeat(clampRating(value)) + "☆".repeat(5 - clampRating(value));
export function filterItems(items, filters) {
  return items.filter((item) => {
    const props = parseProps(item);
    return (!filters.kind || props.kind === filters.kind)
      && (!filters.status || props.status === filters.status)
      && (!filters.tag || (Array.isArray(props.tags) && props.tags.includes(filters.tag)));
  }).sort((a, b) => filters.sort === "rating"
    ? clampRating(parseProps(b).rating) - clampRating(parseProps(a).rating) || b.updated_at - a.updated_at
    : b.updated_at - a.updated_at);
}
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

async function imageUrl(context, ref) {
  if (!MEDIA.test(ref || "")) return null;
  try {
    const data = await context.data.media.read(ref);
    const ext = ref.split(".").pop().replace("jpg", "jpeg");
    return `data:image/${ext};base64,${data}`;
  } catch { return null; }
}

function select(context, value, options, onChange, label) {
  const host = el("span", "nlib-select");
  const control = context.ui.mountSelect(host, { value, options, onChange, ariaLabel: label });
  return { host, dispose: () => control.dispose() };
}

function mountLibrary(context, container) {
  const t = (key) => context.i18n.t(key);
  const root = el("section", "nlib"); container.append(root);
  const state = { kind: "", status: "", tag: "", sort: "date", layout: "grid" };
  let alive = true; let controls = []; let renderGeneration = 0;
  const cleanup = () => { controls.forEach((item) => item.dispose()); controls = []; };
  const render = async () => {
    const generation = ++renderGeneration;
    cleanup(); root.replaceChildren();
    const all = await context.data.objects.query({ type: ITEM_TYPE, limit: 5000 });
    if (!alive || generation !== renderGeneration) return;
    const tags = [...new Set(all.flatMap((item) => parseProps(item).tags || []))].sort();
    const head = el("header", "nlib-head"); head.append(el("h1", "", t("Library")));
    const actions = el("div", "nlib-actions");
    for (const [key, label] of [["grid", "Grid"], ["list", "List"]]) { const b = el("button", state.layout === key ? "is-active" : "", t(label)); b.type="button"; b.onclick=()=>{state.layout=key; void render();}; actions.append(b); }
    head.append(actions); root.append(head);
    const filters = el("div", "nlib-filters");
    const defs = [
      ["kind", t("Kind"), [["", t("All kinds")], ...KINDS.map((x)=>[x,t(x[0].toUpperCase()+x.slice(1))])]],
      ["status", t("Status"), [["",t("All statuses")], ...STATUSES.map((x)=>[x,t(x[0].toUpperCase()+x.slice(1).replace(/-/g," "))])]],
      ["tag", t("Tag"), [["",t("All tags")], ...tags.map((x)=>[x,x])]],
      ["sort", t("Sort"), [["date",t("Recently updated")],["rating",t("Rating")]]]
    ];
    for (const [key,label,pairs] of defs) { const c=select(context,state[key],pairs.map(([value,name])=>({value,label:name})),(value)=>{state[key]=value;void render();},label); controls.push(c); filters.append(c.host); }
    root.append(filters);
    const items = filterItems(all, state);
    if (!items.length) { root.append(el("p", "nlib-empty", t("No items yet"))); return; }
    const shelf = el("div", `nlib-shelf nlib-shelf--${state.layout}`); root.append(shelf);
    const coverLoads = [];
    for (const item of items) {
      const props = parseProps(item); const card = el("button", "nlib-card"); card.type="button"; card.onclick=()=>void context.ui.openObject(item.id);
      const cover = el("span", "nlib-cover");
      cover.textContent=(item.title || "?").slice(0,2).toUpperCase();
      const copy=el("span","nlib-copy"); copy.append(el("strong","",item.title),el("span","nlib-stars",stars(props.rating)),el("small","",[props.creator,props.year,props.kind].filter(Boolean).join(" · ")));
      card.append(cover,copy); shelf.append(card);
      coverLoads.push(imageUrl(context, props.cover).then((url) => {
        if (!url || !alive || generation !== renderGeneration) return;
        const img=document.createElement("img"); img.src=url; img.alt=""; cover.replaceChildren(img);
      }));
    }
    await Promise.all(coverLoads);
  };
  const stop=context.events.on("workspace.changed",()=>void render()); void render();
  return { dispose(){alive=false;renderGeneration++;stop.dispose();cleanup();root.remove();} };
}

async function quickAdd(context) {
  const t=(key)=>context.i18n.t(key); const body=el("form","nlib-add");
  const title=document.createElement("input"); title.placeholder=t("Title"); title.required=true; title.maxLength=200;
  let kind="book"; const kindControl=select(context,kind,KINDS.map((value)=>({value,label:t(value[0].toUpperCase()+value.slice(1))})),(value)=>{kind=value;},t("Kind"));
  const cover=el("button","",t("Choose cover")); cover.type="button"; let coverRef=""; cover.onclick=async()=>{const ref=await context.data.media.pickImage();if(ref){coverRef=ref;cover.textContent="✓ "+t("Choose cover");}};
  const submit=el("button","nlib-primary",t("Add")); submit.type="submit"; body.append(title,kindControl.host,cover,submit);
  let close=()=>{}; body.onsubmit=async(event)=>{event.preventDefault();const value=title.value.trim();if(!value)return;await context.data.objects.create({type:ITEM_TYPE,title:value,content:emptyDocument(),props:JSON.stringify({kind,status:"wishlist",cover:coverRef,tags:[]})});close();kindControl.dispose();};
  const modal=context.ui.modal({title:t("New library item"),mount:({container})=>{container.append(body);return{dispose:()=>kindControl.dispose()};}}); close=()=>modal.dispose(); return modal;
}

export default {
  manifest:{id:"notible.library",name:"Library",version:"0.1.0",apiVersion:"1.27",permissions:["data.read","data.write","media.read","media.write","workspace.ui"]},
  async onload(context){
    await context.data.types.upsert(ITEM_TYPE,JSON.stringify({fields:{kind:{type:"select",options:KINDS},creator:{type:"text"},year:{type:"number"},status:{type:"select",options:STATUSES},rating:{type:"number"},cover:{type:"text"},link:{type:"url"},tags:{type:"tags"},finishedDate:{type:"date"}}}),"library");
    context.views.register({id:"library",title:"Library",nav:true,navIcon:"library",mount:({container})=>mountLibrary(context,container)});
    context.commands.register({id:"quick-add",name:"New library item",creates:{objectType:ITEM_TYPE,label:"Library item",icon:"library"},execute:()=>quickAdd(context)});
  }
};
