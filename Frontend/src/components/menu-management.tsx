'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, LayoutGrid, ListFilter, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import './menu-management.css';

type Dish = { id?: string; name: string; category: string; type: 'Veg'|'Non-Veg'|'Egg'|'Vegan'; price: number; qty: number; unit: string; serving: string; available: boolean; image: string; description: string; time: string; spice: string; cuisine?: string; ingredients?: string[]; allergens?: string[]; pricingOptions?: { mode?: string; portions?: { quarter?: number; half?: number; full?: number }; dryPrice?: number; gravyPrice?: number } | null; nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number } | null };
type Category = { id: string; name: string; count: number };

export function MenuManagement({ food, all, restaurants, restaurantId, current, setCurrent, search, setSearch, filter, setFilter, open, edit, setFood, confirm, exportCsv, notice, canWrite }: {
  food: Dish[]; all: Dish[]; restaurants: { id?: string; name: string }[]; restaurantId: string; current: string; setCurrent: (name: string) => void;
  search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; open: () => void;
  edit: (kind: 'food', index: number) => void; setFood: (value: Dish[]|((current: Dish[]) => Dish[])) => void;
  confirm: (value: { title: string; message: string; action: () => void }|null) => void; exportCsv: (kind: string) => void; notice: (value: string) => void; canWrite: boolean;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [manageCategories, setManageCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editingName, setEditingName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [view, setView] = useState<'category'|'grid'>('category');

  const loadCategories = async () => {
    if (!restaurantId) { setCategories([]); return; }
    const response = await fetch(`/api/restaurants/${restaurantId}/categories`);
    if (response.ok) setCategories((await response.json()).data);
  };
  useEffect(() => { void loadCategories(); }, [restaurantId]);

  const visible = useMemo(() => food.filter(dish => selectedCategory === 'All Categories' || dish.category === selectedCategory), [food, selectedCategory]);
  const groupNames = categories.length ? categories.map(category => category.name) : [...new Set(visible.map(dish => dish.category))];
  const groups = selectedCategory === 'All Categories'
    ? groupNames.map(name => ({ name, dishes: visible.filter(dish => dish.category === name) })).filter(group => group.dishes.length)
    : [{ name: selectedCategory, dishes: visible }];

  const createCategory = async () => {
    const name = newCategory.trim(); if (!name || !restaurantId) return;
    setCategoryBusy(true);
    const response = await fetch(`/api/restaurants/${restaurantId}/categories`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const result = await response.json(); setCategoryBusy(false);
    if (!response.ok) { notice(result.error || 'Could not add category'); return; }
    setNewCategory(''); await loadCategories(); setSelectedCategory(name); notice('Category added');
  };
  const saveCategory = async (category: Category) => {
    const name = editingName.trim(); if (!name || name === category.name) { setEditingId(null); return; }
    const response = await fetch(`/api/restaurants/${restaurantId}/categories/${category.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) { notice(result.error || 'Could not rename category'); return; }
    setFood(current => current.map(dish => dish.category === category.name ? { ...dish, category: name } : dish));
    setSelectedCategory(current => current === category.name ? name : current); setEditingId(null); await loadCategories(); notice('Category renamed');
  };
  const removeCategory = (category: Category) => confirm({ title: `Delete ${category.name}?`, message: category.count ? `This category has ${category.count} dishes. They will become uncategorized.` : 'This category will be removed.', action: async () => {
    const response = await fetch(`/api/restaurants/${restaurantId}/categories/${category.id}`, { method: 'DELETE' });
    if (!response.ok) { notice('Could not delete category'); return; }
    setFood(current => current.map(dish => dish.category === category.name ? { ...dish, category: 'Main Course' } : dish));
    setSelectedCategory('All Categories'); await loadCategories(); notice('Category deleted');
  } });
  const toggleStock = async (dish: Dish) => {
    if (dish.id) {
      const response = await fetch(`/api/menu/${dish.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ available: !dish.available }) });
      if (!response.ok) { notice('Could not update availability'); return; }
    }
    setFood(current => current.map(item => item === dish || (dish.id !== undefined && item.id === dish.id) ? { ...item, available: !dish.available } : item));
  };
  const dishPrice = (dish: Dish) => {
    const p = dish.pricingOptions;
    if (p?.mode === 'PORTIONS' && p.portions) {
      const values = [p.portions.quarter, p.portions.half, p.portions.full].filter((value): value is number => typeof value === 'number');
      if (values.length) return values.length > 1 ? `₹${Math.min(...values)} – ₹${Math.max(...values)}` : `₹${values[0]}`;
    }
    if (p?.mode === 'DRY_GRAVY' && typeof p.dryPrice === 'number' && typeof p.gravyPrice === 'number') return `₹${Math.min(p.dryPrice, p.gravyPrice)} – ₹${Math.max(p.dryPrice, p.gravyPrice)}`;
    return `₹${dish.price}`;
  };
  const dishCard = (dish: Dish) => {
    const index = all.indexOf(dish);
    return <article className="dish-card" key={dish.id||`${dish.name}-${index}`}>
      <div className="dish-card-main"><div className="dish-photo">{dish.image.startsWith('http')||dish.image.startsWith('/uploads/')?<img src={dish.image} alt={dish.name}/>:dish.image||<UtensilsCrossed size={21}/>}</div><div className="dish-card-info">
        <div className={`dish-diet ${dish.type==='Veg'?'veg':'nonveg'}`}><i/>{dish.type}</div><h3>{dish.name}</h3><strong className="dish-price">{dishPrice(dish)}</strong>
        {dish.pricingOptions?.mode === 'PORTIONS' && <div className="portion-tags">{(['quarter','half','full'] as const).map(key=>dish.pricingOptions?.portions?.[key]!==undefined&&<span key={key}>{key==='quarter'?'¼':key==='half'?'½':'Full'}: ₹{dish.pricingOptions.portions[key]}</span>)}</div>}
        {dish.pricingOptions?.mode === 'DRY_GRAVY' && <div className="portion-tags"><span>Dry: ₹{dish.pricingOptions.dryPrice}</span><span>Gravy: ₹{dish.pricingOptions.gravyPrice}</span></div>}
        <span className="dish-category-pill">{dish.category}</span><p>{dish.description||'No description added.'}</p>
      </div></div>
      <div className="dish-card-actions"><button className={`stock-switch ${dish.available?'on':''}`} aria-label={dish.available?'Mark sold out':'Mark available'} disabled={!canWrite} onClick={()=>void toggleStock(dish)}><i/></button><strong className={dish.available?'stock-on':'stock-off'}>{dish.available?'AVAILABLE':'SOLD OUT'}</strong>{canWrite&&<span className="dish-action-buttons"><button aria-label={`Edit ${dish.name}`} onClick={()=>edit('food',index)}><Pencil size={16}/></button><button aria-label={`Delete ${dish.name}`} onClick={()=>confirm({title:'Remove this dish?',message:`${dish.name} will be removed from the menu.`,action:async()=>{if(dish.id){const response=await fetch(`/api/menu/${dish.id}`,{method:'DELETE'});if(!response.ok){notice('Could not remove dish');return}}setFood(current=>current.filter(item=>item!==dish&&(!dish.id||item.id!==dish.id)));notice('Dish removed')}})}><Trash2 size={16}/></button></span>}</div>
    </article>;
  };

  return <>
    <div className="dish-page-top"><div><div className="eyebrow">MENU MANAGEMENT</div><h1>Menu Dishes & Stock</h1><p>Total {all.length} dishes · {all.filter(dish=>dish.available).length} Available · {all.filter(dish=>!dish.available).length} Sold Out</p><select className="dish-restaurant-select" value={current} onChange={event=>setCurrent(event.target.value)} aria-label="Choose restaurant">{restaurants.map(restaurant=><option key={restaurant.id||restaurant.name} value={restaurant.name}>{restaurant.name}</option>)}</select></div><div className="dish-page-actions"><button className="button secondary" onClick={()=>exportCsv('menu')}>Export menu</button>{canWrite&&<button className="button primary" onClick={open}><Plus size={17}/> Add New Dish</button>}</div></div>
    <section className="panel dish-browser"><div className="dish-browser-toolbar"><label className="dish-search"><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search dishes by name, category, or ingredients…"/></label><div className="dish-view-toggle"><button className={view==='category'?'active':''} onClick={()=>setView('category')}><ListFilter size={14}/> By Category</button><button className={view==='grid'?'active':''} onClick={()=>setView('grid')}><LayoutGrid size={14}/> All Grid</button></div><div className="dish-stock-filter">{['All','Available','Unavailable'].map(option=><button className={filter===option?'active':''} key={option} onClick={()=>setFilter(option)}>{option==='Unavailable'?'Sold Out':option}</button>)}</div>{canWrite&&<button className="button secondary category-manage-trigger" onClick={()=>setManageCategories(value=>!value)}>Edit Categories <ChevronDown size={14}/></button>}</div>
      {manageCategories&&canWrite&&<div className="category-manager"><div className="category-manager-head"><div><strong>Edit categories</strong><small>Add, rename, or remove menu categories for {current}.</small></div><button className="icon-btn" aria-label="Close category editor" onClick={()=>setManageCategories(false)}>×</button></div><div className="category-create"><input value={newCategory} onChange={event=>setNewCategory(event.target.value)} onKeyDown={event=>event.key==='Enter'&&void createCategory()} placeholder="New category name"/><button className="button primary" disabled={categoryBusy||!newCategory.trim()} onClick={()=>void createCategory()}><Plus size={15}/> Add category</button></div><div className="category-manager-list">{categories.map(category=><div className="category-manager-row" key={category.id}>{editingId===category.id?<input autoFocus value={editingName} onChange={event=>setEditingName(event.target.value)} onKeyDown={event=>event.key==='Enter'&&void saveCategory(category)}/>:<><strong>{category.name}</strong><small>{category.count} dishes</small></>}{editingId===category.id?<button aria-label="Save category name" onClick={()=>void saveCategory(category)}><Check size={16}/></button>:<button aria-label={`Rename ${category.name}`} onClick={()=>{setEditingId(category.id);setEditingName(category.name)}}><Pencil size={15}/></button>}<button aria-label={`Delete ${category.name}`} onClick={()=>removeCategory(category)}><Trash2 size={15}/></button></div>)}</div></div>}
      <div className="dish-category-strip"><button className={selectedCategory==='All Categories'?'selected':''} onClick={()=>setSelectedCategory('All Categories')}><ListFilter size={14}/>All Categories <span>{all.length}</span></button>{categories.map(category=><button key={category.id} className={selectedCategory===category.name?'selected':''} onClick={()=>setSelectedCategory(category.name)}>{category.name}<span>{category.count}</span></button>)}</div>
      {visible.length===0?<div className="dish-empty"><UtensilsCrossed size={27}/><h3>No dishes here yet</h3><p>Add a dish or choose a different category.</p>{canWrite&&<button className="button primary" onClick={open}><Plus size={16}/> Add New Dish</button>}</div>:view==='grid'?<div className="dish-card-grid">{visible.map(dishCard)}</div>:groups.map(group=><section className="dish-category-group" key={group.name}><h2>{group.name}<span>{group.dishes.length} dishes</span></h2><div className="dish-card-grid">{group.dishes.map(dishCard)}</div></section>)}
    </section>
  </>;
}
