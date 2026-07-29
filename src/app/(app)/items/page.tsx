import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewItemForm from "./NewItemForm";

export default async function ItemsPage() {
  const session = await getServerSession();
  const items = await prisma.item.findMany({
    where: { tenantId: session!.tenantId },
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
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.hsnCode}</td>
                  <td>{i.unit}</td>
                  <td>Rs. {Number(i.salePrice).toFixed(2)}</td>
                  <td>{Number(i.taxRate).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
