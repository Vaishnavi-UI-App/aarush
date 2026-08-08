import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewItemForm from "./NewItemForm";
import DeleteItemButton from "./DeleteItemButton";

export default async function ItemsPage() {
  const session = await getServerSession();
  const items = await prisma.item.findMany({
    where: { tenantId: session!.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="afs-page-title">Items</h1>
      <p className="afs-page-subtitle">Products &amp; services with HSN code and GST rate</p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <NewItemForm />
      </div>

      <div className="afs-card">
        {items.length === 0 ? (
          <div className="afs-empty">No items yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>HSN/SAC</th>
                <th>Unit</th>
                <th>Sale price</th>
                <th>Tax rate</th>
                <th>Stock on hand</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td data-label="Name">{i.name}</td>
                  <td data-label="HSN/SAC">{i.hsnCode}</td>
                  <td data-label="Unit">{i.unit}</td>
                  <td data-label="Sale price">Rs. {Number(i.salePrice).toFixed(2)}</td>
                  <td data-label="Tax rate">{Number(i.taxRate).toFixed(2)}%</td>
                  <td data-label="Stock on hand">
                    {Number(i.currentStock) <= 0 ? (
                      <span className="afs-badge afs-badge-overdue">Out of stock</span>
                    ) : (
                      `${Number(i.currentStock)} ${i.unit}`
                    )}
                  </td>
                  <td>
                    <DeleteItemButton itemId={i.id} itemName={i.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
