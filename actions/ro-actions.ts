"use server";

import { createServiceClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type RO = {
    id: string;
    ro_number: string;
    status: "draft" | "finalized";
    created_at: string;
    finalized_at?: string;
};

export type ScannedPart = {
    id: string;
    ro_id: string;
    barcode_value: string;
    quantity: number;
    created_at: string;
    updated_at: string;
};

export type FinalEntry = {
    id: string;
    ro_id: string;
    ro_number: string;
    finalized_at: string;
};

export async function createRO(roNumber: string) {
    const supabase = await createServiceClient();

    if (!roNumber || roNumber.trim() === "") {
        return { error: "RO Number is required" };
    }

    const { data, error } = await supabase
        .from("ro")
        .insert({ ro_number: roNumber.trim().toUpperCase() })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            return { error: "RO Number already exists" };
        }
        return { error: error.message };
    }

    revalidatePath("/");
    return { success: true, data };
}

export async function searchRO(query: string) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("ro")
        .select("*")
        .ilike("ro_number", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        return { error: error.message };
    }

    return { success: true, data: data as RO[] };
}

export async function getRO(roNumber: string) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("ro")
        .select("*")
        .eq("ro_number", roNumber)
        .single();

    if (error) {
        return { error: "RO not found" };
    }

    return { success: true, data: data as RO };
}

export async function getScannedParts(roId: string) {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("ro_scanned_parts")
        .select("*")
        .eq("ro_id", roId)
        .order("updated_at", { ascending: false });

    if (error) {
        return { error: error.message };
    }

    return { success: true, data: data as ScannedPart[] };
}

export async function scanPart(roId: string, barcode: string) {
    const supabase = await createServiceClient();

    // Check if RO is draft
    const { data: ro, error: roError } = await supabase
        .from("ro")
        .select("status")
        .eq("id", roId)
        .single();

    if (roError || !ro) return { error: "RO not found" };
    if (ro.status !== "draft") return { error: "RO is already finalized" };

    // Upsert part (increment if exists)
    // We can't use simple upsert for incrementing without a function or two steps.
    // Two steps is safer for now without custom SQL functions.

    const { data: existing, error: fetchError } = await supabase
        .from("ro_scanned_parts")
        .select("*")
        .eq("ro_id", roId)
        .eq("barcode_value", barcode)
        .single();

    if (fetchError && fetchError.code !== "PGRST116") { // PGRST116 is not found
        return { error: fetchError.message };
    }

    let result;
    if (existing) {
        result = await supabase
            .from("ro_scanned_parts")
            .update({ quantity: existing.quantity + 1, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select()
            .single();
    } else {
        result = await supabase
            .from("ro_scanned_parts")
            .insert({ ro_id: roId, barcode_value: barcode, quantity: 1 })
            .select()
            .single();
    }

    if (result.error) {
        return { error: result.error.message };
    }

    revalidatePath(`/ro/[ro_number]`); // We'll need to pass ro_number or just revalidate generic
    return { success: true, data: result.data };
}

export async function updatePartQuantity(scanId: string, quantity: number) {
    const supabase = await createServiceClient();

    if (quantity < 1) {
        return { error: "Quantity must be at least 1" };
    }

    const { error } = await supabase
        .from("ro_scanned_parts")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", scanId);

    if (error) return { error: error.message };

    revalidatePath(`/ro/[ro_number]`);
    return { success: true };
}

export async function deletePart(scanId: string) {
    const supabase = await createServiceClient();

    const { error } = await supabase
        .from("ro_scanned_parts")
        .delete()
        .eq("id", scanId);

    if (error) return { error: error.message };

    revalidatePath(`/ro/[ro_number]`);
    return { success: true };
}

export async function finalizeRO(roId: string, roNumber: string) {
    const supabase = await createServiceClient();

    // 1. Verify RO is draft
    const { data: ro, error: roError } = await supabase
        .from("ro")
        .select("status")
        .eq("id", roId)
        .single();

    if (roError || !ro) return { error: "RO not found" };
    if (ro.status !== "draft") return { error: "RO is already finalized" };

    // 2. Get all parts
    const { data: parts, error: partsError } = await supabase
        .from("ro_scanned_parts")
        .select("*")
        .eq("ro_id", roId);

    if (partsError) return { error: partsError.message };
    if (!parts || parts.length === 0) return { error: "Cannot finalize empty RO" };

    // 3. Perform Transaction (Simulated via sequential operations as Supabase JS doesn't support explicit transactions easily without RPC)
    // Ideally we use an RPC function for this to be atomic.
    // For this task, I will create an RPC function in the schema if I could, but I already wrote the schema.
    // I will try to do it carefully here. If it fails mid-way, we might have issues.
    // BETTER APPROACH: Use RPC.
    // I will write a SQL RPC function via a separate tool call to `schema.sql` or just execute it if I could.
    // Since I can't easily run SQL now without user intervention, I will do it in code but check rigorously.
    // Actually, the prompt asked for "Finalization must run in a PostgreSQL transaction".
    // Supabase JS client doesn't do transactions. I MUST use an RPC function.

    // I will append the RPC function to schema.sql and ask user to run it, OR I can try to define it here if I had a way.
    // I will assume the user will run the updated schema.sql.

    // Wait, I can't update schema.sql easily if the user already ran it? 
    // I will update schema.sql now to include the RPC function, and tell the user to run it.

    // But for now, I will implement the action calling the RPC.

    const { data, error } = await supabase.rpc('finalize_ro', {
        p_ro_id: roId,
        p_ro_number: roNumber
    });

    if (error) return { error: error.message };

    revalidatePath("/");
    return { success: true };
}

export async function getFinalizedEntries() {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
        .from("ro_final_entries")
        .select("*")
        .order("finalized_at", { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: data as FinalEntry[] };
}
