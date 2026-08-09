import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewItemForm from "./NewItemForm";
import EditableItemRow from "./EditableItemRow";

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
                <EditableItemRow
                  key={i.id}
                  item={{
                    id: i.id,
                    name: i.name,
                    description: i.description,
                    hsnCode: i.hsnCode,
                    unit: i.unit,
                    salePrice: Number(i.salePrice),
                    taxRate: Number(i.taxRate),
                    currentStock: Number(i.currentStock),
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
