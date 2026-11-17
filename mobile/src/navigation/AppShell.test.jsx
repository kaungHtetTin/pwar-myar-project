import React from "react";
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AppShell } from "./AppShell";
import { AppBarMenu } from './AppBarMenu';
import { PageAppBar } from './PageAppBar';
import { ProductReferenceHeader } from "../products/ProductReferenceParts";
import { appBarRoute } from "./appBarRoute";
import { usePageRefresh } from "./pageRefresh";
import { LocaleProvider } from "../localization/LocaleProvider";
import { Capacitor } from "@capacitor/core";

it.each([false, true])('opens in-app AI and preserves the source draft (native: %s)', (native) => {
  const nativeSpy = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
  const navigate = vi.fn();
  render(<LocaleProvider><AppShell session={session} modules={modules} activeModule={modules[0]} pathname="/products" onNavigatePath={navigate}><input aria-label="Product search draft" defaultValue="Water" /></AppShell></LocaleProvider>);
  fireEvent.click(screen.getByRole('button', { name: /^Open (?:app menu|navigation)$/ }));
  const link = screen.getByRole('link', { name: /PwarMyar AI assistant/ });
  expect(link).toHaveAttribute('href', '/assistant');
  fireEvent.click(link);
  expect(screen.queryByRole('dialog', { name: 'Main navigation' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Product search draft')).toHaveValue('Water');
  expect(navigate).toHaveBeenCalledWith('/assistant');
  nativeSpy.mockRestore();
});

it("offers tutorials to sell-only staff and uses a separate web tab", () => {
  render(
    <LocaleProvider>
      <AppShell
        session={session}
        modules={[{ id: "sell", label: "Sell", path: "/sell" }]}
        activeModule={{ id: "sell", label: "Sell" }}
      >
        <p>Sale draft</p>
      </AppShell>
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
  const link = screen.getByRole("link", { name: /Tutorials/ });
  expect(link).toHaveAttribute("href", "http://127.0.0.1:8000/tutorials");
  expect(link).toHaveAttribute("target", "_blank");
});

it("lets Capacitor open the remote tutorial page using the Android browser", () => {
  const native = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  render(
    <LocaleProvider>
      <AppShell session={session} modules={modules} activeModule={modules[0]}>
        <p>Products</p>
      </AppShell>
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
  expect(screen.getByRole("link", { name: /Tutorials/ })).toHaveAttribute(
    "target",
    "_self",
  );
  native.mockRestore();
});

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const session = {
  user: { name: "Moe Myint", role: "owner" },
  business: { name: "Moe Mini Mart" },
  role_name: "Owner",
};

const modules = [
  {
    id: "products",
    label: "Products",
    path: "/products",
    description: "Inventory and pricing",
  },
  {
    id: "reports",
    label: "Reports",
    path: "/reports",
    description: "Business performance",
  },
];

const trialSession = {
  ...session,
  subscription: {
    is_valid: true,
    access_type: "trial",
    ends_at: "2030-05-01T00:00:00Z",
    days_remaining: 6,
    lifecycle_notice: {
      stage: "warning",
      message: "Backup download and data restore require a paid plan.",
    },
  },
};

it('uses Reports as the final bottom destination and opens it once', () => {
  const onNavigatePath = vi.fn();
  const { rerender } = render(<AppShell session={session} modules={modules} activeModule={modules[0]} pathname="/products" onNavigatePath={onNavigatePath}><PageAppBar><h1>Page</h1><AppBarMenu /></PageAppBar></AppShell>);
  const navigation = screen.getByRole('navigation', { name: 'Workspace modules' });
  const reports = within(navigation).getByRole('button', { name: 'Reports', exact: true });
  expect(navigation.lastElementChild).toBe(reports);
  expect(within(navigation).queryByRole('button', { name: /More|Open app menu|Open navigation/ })).not.toBeInTheDocument();
  fireEvent.click(reports);
  expect(onNavigatePath).toHaveBeenCalledExactlyOnceWith('/reports');
  expect(screen.queryByRole('dialog', { name: 'Main navigation' })).not.toBeInTheDocument();
  rerender(<AppShell session={session} modules={modules} activeModule={modules[1]} pathname="/reports" onNavigatePath={onNavigatePath}><PageAppBar><h1>Page</h1><AppBarMenu /></PageAppBar></AppShell>);
  expect(screen.getByRole('button', { name: 'Reports', exact: true })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Reports', exact: true }));
  expect(onNavigatePath).toHaveBeenCalledTimes(1);
});

it('omits Reports when the module is unavailable', () => {
  render(<AppShell session={{ ...session, user: { role: 'staff' }, permissions: ['products'] }} modules={[modules[0]]} activeModule={modules[0]} pathname="/products"><PageAppBar><h1>Page</h1><AppBarMenu /></PageAppBar></AppShell>);
  const navigation = screen.getByRole('navigation', { name: 'Workspace modules' });
  expect(within(navigation).queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open app menu' }));
  expect(screen.getByRole('dialog', { name: 'Main navigation' })).toBeInTheDocument();
});

it("keeps offline invoices accessible through the app menu on the full-page Sell layout", () => {
  const navigatePath = vi.fn();
  const sellModule = { id: "sell", label: "Sell", path: "/sell" };
  const { container } = render(
    <LocaleProvider>
      <AppShell session={session} modules={[sellModule]} activeModule={sellModule} pathname="/sell" onNavigatePath={navigatePath}>
        <PageAppBar><h1>Page</h1><AppBarMenu /></PageAppBar><p>Sell products</p>
      </AppShell>
    </LocaleProvider>,
  );

  expect(container.querySelector(".mobile-header-logo")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
  fireEvent.click(screen.getByRole("link", { name: /Offline invoices/ }));
  expect(navigatePath).toHaveBeenCalledWith("/sell/offline-sales");
});

it('keeps language switching out of the fallback app bar', () => {
  render(<LocaleProvider><AppShell session={session} modules={modules} activeModule={modules[0]} pathname="/products"><p>Loading products</p></AppShell></LocaleProvider>);
  expect(screen.queryByRole('button', { name: /Change language/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open app menu' }));
  expect(screen.getByRole('switch')).toBeInTheDocument();
});

it('shares chat unread counts with the global header action and refreshes after reading', async () => {
  let unread = 120;
  apiRequest.mockImplementation(async path => path.includes('/notifications') ? { enabled: true, unread_count: unread, cursor: 4, items: [] } : {});
  const navigate = vi.fn(), shopModules = [...modules, { id: 'shop', label: 'My Shop', path: '/shop' }];
  render(<LocaleProvider><AppShell session={session} modules={shopModules} activeModule={modules[0]} pathname="/products" onNavigatePath={navigate}><PageAppBar><h1>Products</h1><AppBarMenu /></PageAppBar></AppShell></LocaleProvider>);
  const chat = await screen.findByRole('button', { name: 'Shop chat, 120 unread messages' });
  expect(chat).toHaveTextContent('99+');
  expect(chat.nextElementSibling).toHaveClass('app-bar-menu');
  expect(screen.queryByRole('button', { name: 'Dismiss chat notification' })).not.toBeInTheDocument();
  expect(chat).toHaveTextContent('99+');
  fireEvent.click(chat);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/shop/chat');
  expect(apiRequest.mock.calls.filter(([path]) => path.includes('/notifications'))).toHaveLength(1);
  unread = 0;
  window.dispatchEvent(new Event('mkpos:shop-chat-read'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shop chat', exact: true })).not.toHaveTextContent('99+'));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('does not expose global shop chat to staff without permission or offline sessions', () => {
  const shop = { id: 'shop', label: 'My Shop', path: '/shop' };
  const view = offline => <LocaleProvider><AppShell session={offline ? session : { ...session, user: { role: 'staff' }, permissions: [] }} modules={[shop]} activeModule={shop} pathname="/shop" offlineMode={offline}><p>Shop</p></AppShell></LocaleProvider>;
  const result = render(view(false));
  expect(screen.queryByRole('button', { name: /^Shop chat/ })).not.toBeInTheDocument();
  result.rerender(view(true));
  expect(screen.queryByRole('button', { name: /^Shop chat/ })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();
});

it("toggles English/Myanmar in the open drawer and remembers the language", () => {
  const { container } = render(
    <LocaleProvider>
      <AppShell session={session} modules={modules} activeModule={modules[0]} pathname="/products">
        <PageAppBar><h1>Page</h1><AppBarMenu /></PageAppBar><p>Products</p>
      </AppShell>
    </LocaleProvider>,
  );

  expect(container.querySelector(".mobile-header-logo")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  expect(document.documentElement.lang).toBe("my");
  expect(window.localStorage.getItem("mkpos.language")).toBe("my");
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(document.documentElement.lang).toBe('en');
  expect(window.localStorage.getItem('mkpos.language')).toBe('en');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Offline invoices" })).not.toBeInTheDocument();
});

function RefreshingPage({ onRefresh }) {
  usePageRefresh(onRefresh);
  return <p>Refreshable content</p>;
}

beforeEach(() => {
  apiRequest.mockReset();
  window.localStorage.clear();
  document.documentElement.lang = "en";
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("drawer navigation shell", () => {
  it('keeps keyboard focus inside the drawer and restores the opener',()=>{
    render(<LocaleProvider><AppShell session={session} modules={modules} activeModule={modules[0]}><p>Content</p></AppShell></LocaleProvider>);
    const opener=screen.getByRole('button',{name:/^Open (?:app menu|navigation)$/});fireEvent.click(opener);
    const close=screen.getAllByRole('button',{name:'Close navigation'}).find(button=>button.closest('aside'));
    const signOut=screen.getByRole('button',{name:'Sign out'});
    expect(close).toHaveFocus();fireEvent.keyDown(window,{key:'Tab',shiftKey:true});expect(signOut).toHaveFocus();fireEvent.keyDown(window,{key:'Tab'});expect(close).toHaveFocus();fireEvent.keyDown(window,{key:'Escape'});expect(opener).toHaveFocus();
  });
  it("shows the uploaded shop logo in the drawer account footer", () => {
    const shopLogo = "data:image/png;base64,aGVsbG8=";
    render(
      <LocaleProvider>
        <AppShell
          session={session}
          shopLogo={shopLogo}
          modules={modules}
          activeModule={modules[0]}
        >
          <p>Products</p>
        </AppShell>
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));

    expect(screen.getByRole("img", { name: "Moe Mini Mart logo" })).toHaveAttribute(
      "src",
      shopLogo,
    );
  });

  it("shows user initials when no shop logo is uploaded", () => {
    const { container } = render(
      <LocaleProvider>
        <AppShell session={session} modules={modules} activeModule={modules[0]}>
          <p>Products</p>
        </AppShell>
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));

    expect(container.querySelector(".drawer-account-avatar.has-logo")).toBeNull();
    expect(container.querySelector(".drawer-account-avatar")).toHaveTextContent("MM");
  });

  it("hides the trial notice throughout Sell while keeping it on other modules", () => {
    const sell = {
      id: "sell",
      label: "Sell",
      path: "/sell",
      description: "Point of sale",
    };
    const { rerender } = render(
      <AppShell
        session={trialSession}
        modules={[sell, ...modules]}
        activeModule={sell}
        pathname="/sell/checkout"
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
      >
        <p>Checkout content</p>
      </AppShell>,
    );

    expect(screen.queryByText("6 days remaining")).not.toBeInTheDocument();

    rerender(
      <AppShell
        session={trialSession}
        modules={[sell, ...modules]}
        activeModule={modules[0]}
        pathname="/products"
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
      >
        <p>Product content</p>
      </AppShell>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("6 days remaining");
  });

  it("derives dynamic app-bar titles and back routes", () => {
    expect(appBarRoute("/products/new", "Products")).toEqual({
      title: "Add product",
      backPath: "/products",
    });
    expect(appBarRoute("/sell/checkout", "Sell")).toEqual({
      title: "Checkout",
      backPath: "/sell/cart",
    });
    expect(appBarRoute("/purchases/8", "Purchases")).toEqual({
      title: "Purchase detail",
      backPath: "/purchases",
    });
    expect(appBarRoute("/sales/8", "Sales")).toEqual({
      title: "Sale detail",
      backPath: "/sales",
    });
    expect(appBarRoute("/sales/8/edit", "Sales")).toEqual({
      title: "Edit sale",
      backPath: "/sales",
    });
    expect(appBarRoute("/reports", "Reports")).toEqual({
      title: "Reports",
      backPath: null,
    });
  });

  it("delegates the product task header and preserves source-aware Back", () => {
    const onNavigatePath = vi.fn();
    const onNavigateBack = vi.fn();
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        pathname="/products/new"
        onNavigate={vi.fn()}
        onNavigatePath={onNavigatePath}
        onNavigateBack={onNavigateBack}
        onLoggedOut={vi.fn()}
      >
        <ProductReferenceHeader title="New product" onBack={() => onNavigateBack("/products")} />
      </AppShell>,
    );

    expect(screen.getByText("New product")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open app menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to products" }));
    expect(onNavigateBack).toHaveBeenCalledWith("/products");
    expect(onNavigatePath).not.toHaveBeenCalled();
  });
  it("opens the drawer, marks the current module, and navigates", () => {
    const onNavigate = vi.fn();
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={onNavigate}
        onLoggedOut={vi.fn()}
      >
        <p>Page content</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
    expect(
      screen.getByRole("dialog", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Products/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("link", { name: /Reports/ }));
    expect(onNavigate).toHaveBeenCalledWith(modules[1]);
    expect(
      screen.queryByRole("dialog", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });

  it("renders the active header and drawer navigation in Myanmar", () => {
    window.localStorage.setItem("mkpos.language", "my");
    render(
      <LocaleProvider>
        <AppShell
          session={session}
          modules={modules}
          activeModule={modules[0]}
          onNavigate={vi.fn()}
          onLoggedOut={vi.fn()}
        >
          <p>Page content</p>
        </AppShell>
      </LocaleProvider>,
    );

    expect(within(screen.getByRole('banner')).getByText("ကုန်ပစ္စည်းများ")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "အက်ပ် မီနူးဖွင့်ရန်" }),
    );
    expect(
      screen.getByRole("dialog", { name: "အဓိက လမ်းညွှန်မီနူး" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /ကုန်ပစ္စည်းများ/,
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "ထွက်မည်" })).toBeInTheDocument();
  });

  it("closes with Escape and restores page scrolling", () => {
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
      >
        <p>Page content</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("consumes Android hardware Back to close the navigation drawer", () => {
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
      >
        <p>Page content</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));

    const event = new CustomEvent("mkpos:hardware-back", { cancelable: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(
      screen.queryByRole("dialog", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });

  it("logs out from the account footer", async () => {
    const onLoggedOut = vi.fn();
    apiRequest.mockResolvedValue({});
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={vi.fn()}
        onLoggedOut={onLoggedOut}
      >
        <p>Page content</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Open (?:app menu|navigation)$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledOnce());
    expect(apiRequest).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  });

  it('removes the saved access token when signing out offline without a network request', async () => {
    window.localStorage.setItem('mkpos.mobile.accessToken', 'offline-session-token');
    const onLoggedOut = vi.fn();
    render(<AppShell session={session} modules={modules} activeModule={modules[0]} offlineMode onLoggedOut={onLoggedOut}><p>Offline page</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open app menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem('mkpos.mobile.accessToken')).toBeNull();
    expect(apiRequest.mock.calls.some(([path]) => path === '/auth/logout')).toBe(false);
  });

  it("refreshes app and current-page data after a pull past the threshold", async () => {
    const refreshApp = vi.fn().mockResolvedValue({});
    const refreshPage = vi.fn().mockResolvedValue({});
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
        onRefresh={refreshApp}
      >
        <RefreshingPage onRefresh={refreshPage} />
      </AppShell>,
    );

    const shell = screen.getByRole("region", { name: "Pull to refresh page" });
    fireEvent.touchStart(shell, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(shell, { touches: [{ clientY: 180 }] });
    expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    fireEvent.touchEnd(shell, { changedTouches: [{ clientY: 180 }] });

    await waitFor(() => {
      expect(refreshApp).toHaveBeenCalledOnce();
      expect(refreshPage).toHaveBeenCalledOnce();
    });
  });

  it("snaps back without refreshing below the pull threshold", () => {
    const refreshApp = vi.fn();
    render(
      <AppShell
        session={session}
        modules={modules}
        activeModule={modules[0]}
        onNavigate={vi.fn()}
        onLoggedOut={vi.fn()}
        onRefresh={refreshApp}
      >
        <p>Page content</p>
      </AppShell>,
    );

    const shell = screen.getByRole("region", { name: "Pull to refresh page" });
    fireEvent.touchStart(shell, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(shell, { touches: [{ clientY: 70 }] });
    fireEvent.touchEnd(shell, { changedTouches: [{ clientY: 70 }] });

    expect(refreshApp).not.toHaveBeenCalled();
    expect(screen.queryByText("Release to refresh")).not.toBeInTheDocument();
  });
});
