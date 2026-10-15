import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { readCache, writeCache } from '../lib/offlineCache';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

const CategoryContext = createContext(null);

const DEFAULT_GUEST_CATEGORIES = [
  // Needs
  {
    id: 'cat-groceries',
    workspace_id: null,
    name: 'Groceries & Supermarket',
    kind: 'expense',
    is_essential: true,
    icon: '🛒',
    color: '#10b981',
    parent_id: null,
    system_key: 'food_groceries',
  },
  {
    id: 'cat-housing',
    workspace_id: null,
    name: 'Housing & Rent',
    kind: 'expense',
    is_essential: true,
    icon: '🏠',
    color: '#f59e0b',
    parent_id: null,
    system_key: 'housing_rent',
  },
  {
    id: 'cat-utilities',
    workspace_id: null,
    name: 'Utilities & Bills',
    kind: 'expense',
    is_essential: true,
    icon: '💡',
    color: '#06b6d4',
    parent_id: null,
    system_key: 'utilities',
  },
  {
    id: 'cat-transport',
    workspace_id: null,
    name: 'Transportation & Fuel',
    kind: 'expense',
    is_essential: true,
    icon: '🚗',
    color: '#3b82f6',
    parent_id: null,
    system_key: 'transportation',
  },
  {
    id: 'cat-healthcare',
    workspace_id: null,
    name: 'Healthcare & Medicine',
    kind: 'expense',
    is_essential: true,
    icon: '💊',
    color: '#14b8a6',
    parent_id: null,
    system_key: 'healthcare',
  },
  // Wants
  {
    id: 'cat-dining',
    workspace_id: null,
    name: 'Dining Out & Cafes',
    kind: 'expense',
    is_essential: false,
    icon: '🍜',
    color: '#ec4899',
    parent_id: null,
    system_key: 'dining_out',
  },
  {
    id: 'cat-entertainment',
    workspace_id: null,
    name: 'Entertainment & Leisure',
    kind: 'expense',
    is_essential: false,
    icon: '🎬',
    color: '#d946ef',
    parent_id: null,
    system_key: 'entertainment',
  },
  {
    id: 'cat-shopping',
    workspace_id: null,
    name: 'Shopping & Apparel',
    kind: 'expense',
    is_essential: false,
    icon: '🛍️',
    color: '#f43f5e',
    parent_id: null,
    system_key: 'shopping',
  },
  {
    id: 'cat-software',
    workspace_id: null,
    name: 'Software & Cloud Tools',
    kind: 'expense',
    is_essential: false,
    icon: '☁️',
    color: '#6366f1',
    parent_id: null,
    system_key: 'software_tools',
  },
  // Income
  {
    id: 'cat-salary',
    workspace_id: null,
    name: 'Salary & Client Retainers',
    kind: 'income',
    is_essential: false,
    icon: '💼',
    color: '#10b981',
    parent_id: null,
    system_key: 'salary',
  },
  {
    id: 'cat-freelance',
    workspace_id: null,
    name: 'Freelance & Consulting',
    kind: 'income',
    is_essential: false,
    icon: '⚡',
    color: '#6366f1',
    parent_id: null,
    system_key: 'freelance',
  },
  {
    id: 'cat-investments',
    workspace_id: null,
    name: 'Investments & Dividends',
    kind: 'income',
    is_essential: false,
    icon: '📈',
    color: '#3b82f6',
    parent_id: null,
    system_key: 'investments',
  },
];

const DEFAULT_GUEST_TAGS = [
  { id: 'tag-1', name: 'Tax Deductible', color: '#10b981' },
  { id: 'tag-2', name: 'Reimbursable', color: '#3b82f6' },
  { id: 'tag-3', name: 'Project Alpha', color: '#8b5cf6' },
  { id: 'tag-4', name: 'Personal Vacation', color: '#ec4899' },
];

const DEFAULT_GUEST_MERCHANTS = [
  {
    id: 'merch-1',
    name: 'Amazon',
    aliases: ['Amazon Web Services', 'Amazon.com', 'AMZN MKTP'],
    default_category_id: 'cat-shopping',
    logo_url: null,
  },
  {
    id: 'merch-2',
    name: 'Carrefour Supermarket',
    aliases: ['Carrefour Express', 'MAF Carrefour'],
    default_category_id: 'cat-groceries',
    logo_url: null,
  },
  {
    id: 'merch-3',
    name: 'Uber & Careem',
    aliases: ['Uber BV', 'Careem Ride'],
    default_category_id: 'cat-transport',
    logo_url: null,
  },
];

export function CategoryProvider({ children }) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [categories, setCategories] = useState(DEFAULT_GUEST_CATEGORIES);
  const [tags, setTags] = useState(DEFAULT_GUEST_TAGS);
  const [merchants, setMerchants] = useState(DEFAULT_GUEST_MERCHANTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id || !user || currentWorkspace.id === 'guest-space') {
      setCategories(DEFAULT_GUEST_CATEGORIES);
      setTags(DEFAULT_GUEST_TAGS);
      setMerchants(DEFAULT_GUEST_MERCHANTS);
      setLoading(false);
      return;
    }

    try {
      const cached = readCache('catalog', user.id, currentWorkspace.id);
      if (cached) {
        setCategories(cached.categories || []);
        setTags(cached.tags || []);
        setMerchants(cached.merchants || []);
      }
      setLoading(!cached);
      setError(null);

      // Fetch Categories (System-wide templates with NULL workspace_id OR workspace-scoped custom ones)
      const { data: catData, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .or(`workspace_id.is.null,workspace_id.eq.${currentWorkspace.id}`)
        .is('archived_at', null)
        .order('name', { ascending: true });

      if (catErr) throw catErr;

      // Fetch Tags
      const { data: tagData, error: tagErr } = await supabase
        .from('tags')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name', { ascending: true });

      if (tagErr) throw tagErr;

      // Fetch Merchants
      const { data: merchData, error: merchErr } = await supabase
        .from('merchants')
        .select('*, default_category:categories(id, name, icon, color)')
        .eq('workspace_id', currentWorkspace.id)
        .order('name', { ascending: true });

      if (merchErr) throw merchErr;

      setCategories(catData || []);
      setTags(tagData || []);
      setMerchants(merchData || []);
      writeCache('catalog', user.id, currentWorkspace.id, {
        categories: catData || [], tags: tagData || [], merchants: merchData || [],
      });
    } catch (err) {
      console.warn('[CategoryContext] Error fetching catalog:', err.message);
      const cached = readCache('catalog', user.id, currentWorkspace.id);
      if (cached) {
        setCategories(cached.categories || []);
        setTags(cached.tags || []);
        setMerchants(cached.merchants || []);
      } else {
        setError(err.message);
        setCategories([]);
        setTags([]);
        setMerchants([]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Category Actions
  const createCategory = async ({
    name,
    kind,
    isEssential = false,
    icon = '📦',
    color = '#6366f1',
    parentId = null,
  }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const newCat = {
        id: `cat-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name,
        kind,
        is_essential: isEssential,
        icon,
        color,
        parent_id: parentId,
      };
      setCategories((prev) => [...prev, newCat]);
      return { data: newCat, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('categories')
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          kind,
          is_essential: isEssential,
          icon,
          color,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      await fetchData();
      return { data, error: null };
    } catch (err) {
      console.error('[CategoryContext] Create category error:', err);
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const updateCategory = async (categoryId, updates) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, ...updates } : c))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId);

      if (updErr) throw updErr;
      await fetchData();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  const archiveCategory = async (categoryId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      return { error: null };
    }

    try {
      const { error: archErr } = await supabase
        .from('categories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', categoryId);

      if (archErr) throw archErr;
      await fetchData();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Tag Actions
  const createTag = async ({ name, color = '#8b5cf6' }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const newTag = {
        id: `tag-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name: name.trim(),
        color,
      };
      setTags((prev) => [...prev, newTag]);
      return { data: newTag, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('tags')
        .insert({
          workspace_id: currentWorkspace.id,
          name: name.trim(),
          color,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      await fetchData();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const deleteTag = async (tagId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (delErr) throw delErr;
      await fetchData();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Merchant Actions
  const createMerchant = async ({
    name,
    aliases = [],
    defaultCategoryId = null,
    logoUrl = null,
  }) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      const newMerch = {
        id: `merch-${Date.now()}`,
        workspace_id: currentWorkspace?.id || 'guest-space',
        name: name.trim(),
        aliases,
        default_category_id: defaultCategoryId,
        logo_url: logoUrl,
      };
      setMerchants((prev) => [...prev, newMerch]);
      return { data: newMerch, error: null };
    }

    try {
      setError(null);
      const { data, error: insertErr } = await supabase
        .from('merchants')
        .insert({
          workspace_id: currentWorkspace.id,
          name: name.trim(),
          aliases,
          default_category_id: defaultCategoryId || null,
          logo_url: logoUrl || null,
        })
        .select('*, default_category:categories(id, name, icon, color)')
        .single();

      if (insertErr) throw insertErr;
      await fetchData();
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      return { data: null, error: err };
    }
  };

  const updateMerchant = async (merchantId, updates) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setMerchants((prev) =>
        prev.map((m) => (m.id === merchantId ? { ...m, ...updates } : m))
      );
      return { error: null };
    }

    try {
      const { error: updErr } = await supabase
        .from('merchants')
        .update(updates)
        .eq('id', merchantId);

      if (updErr) throw updErr;
      await fetchData();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  const deleteMerchant = async (merchantId) => {
    if (!user || currentWorkspace?.id === 'guest-space') {
      setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
      return { error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('merchants')
        .delete()
        .eq('id', merchantId);

      if (delErr) throw delErr;
      await fetchData();
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    }
  };

  // Memoized Category Classification
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense'),
    [categories]
  );

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === 'income'),
    [categories]
  );

  const needsCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && c.is_essential),
    [categories]
  );

  const wantsCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && !c.is_essential),
    [categories]
  );

  return (
    <CategoryContext.Provider
      value={{
        categories,
        tags,
        merchants,
        loading,
        error,
        expenseCategories,
        incomeCategories,
        needsCategories,
        wantsCategories,
        createCategory,
        updateCategory,
        archiveCategory,
        createTag,
        deleteTag,
        createMerchant,
        updateMerchant,
        deleteMerchant,
        refreshCatalog: fetchData,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  if (!ctx) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return ctx;
}
