import { describe, it, expect } from "vitest";
import {
  FileReceiver,
  buildAbortFrame,
  buildDeadDropFileRecord,
  buildDoneFrame,
  buildInitFrame,
  decryptChunk,
  decryptDeadDropFile,
  encryptChunk,
  isFileControl,
  parseFileControl,
  prepareFileTransfer,
  sha256Hex,
  sliceFile,
} from "../lib/file-transfer";

function bytesOf(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

async function roundtrip(
  data: Uint8Array<ArrayBuffer>,
): Promise<{ receiver: FileReceiver; assembled: Uint8Array<ArrayBuffer> }> {
  const prep = await prepareFileTransfer(
    { name: "evidence.pdf", mime: "application/pdf", size: data.length },
    data,
  );
  const receiver = new FileReceiver();
  receiver.setKey(prep.keyB64);
  receiver.feedControl(buildInitFrame(prep.meta));
  for (const chunk of prep.chunks) {
    const enc = await encryptChunk(chunk, prep.keyB64);
    receiver.feedBinary(enc.buffer as ArrayBuffer);
  }
  receiver.feedControl(buildDoneFrame(prep.meta));
  await receiver.whenComplete();
  return { receiver, assembled: receiver.done()?.assembled ?? new Uint8Array(0) };
}

describe("prepareFileTransfer", () => {
  it("hashes, slices, and mints a key", async () => {
    const data = bytesOf("hello world");
    const prep = await prepareFileTransfer({ name: "a.txt", mime: "text/plain", size: data.length }, data);
    expect(prep.meta.name).toBe("a.txt");
    expect(prep.meta.size).toBe(11);
    expect(prep.meta.chunkSize).toBe(8192);
    expect(prep.meta.chunkCount).toBe(1);
    expect(prep.meta.sha256).toHaveLength(64);
    expect(prep.keyB64).toBeTruthy();
    const rebuilt = prep.chunks.flatMap((c) => [...c]);
    expect(new TextDecoder().decode(Uint8Array.from(rebuilt))).toBe("hello world");
  });

  it("slices >1 chunk and keeps byte order", async () => {
    const data: Uint8Array<ArrayBuffer> = new Uint8Array(20_000).map((_, i) => i % 251);
    const prep = await prepareFileTransfer({ name: "big", mime: "", size: data.length }, data);
    expect(prep.meta.chunkCount).toBe(3);
    const out = new Uint8Array(data.length);
    let offset = 0;
    for (const c of prep.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    expect(Array.from(out)).toEqual(Array.from(data));
  });

  it("sha256Hex matches a known vector", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex(bytesOf("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("encrypt/decrypt chunks", () => {
  it("round-trips with random IVs per chunk", async () => {
    const prep = await prepareFileTransfer({ name: "x", mime: "", size: 5 }, bytesOf("hello"));
    const e1 = await encryptChunk(bytesOf("hello"), prep.keyB64);
    const e2 = await encryptChunk(bytesOf("hello"), prep.keyB64);
    expect(Array.from(e1)).not.toEqual(Array.from(e2)); // different IVs
    expect(Array.from(await decryptChunk(e1, prep.keyB64))).toEqual(
      Array.from(bytesOf("hello")),
    );
  });

  it("fails on a wrong key", async () => {
    const prep = await prepareFileTransfer({ name: "x", mime: "", size: 3 }, bytesOf("abc"));
    const enc = await encryptChunk(bytesOf("abc"), prep.keyB64);
    await expect(decryptChunk(enc, "AAAA")).rejects.toThrow();
  });
});

describe("FileReceiver", () => {
  it("completes a full transfer and verifies sha256", async () => {
    const data = bytesOf("the full evidence bundle");
    const { receiver, assembled } = await roundtrip(data);
    expect(receiver.getState()).toBe("complete");
    expect(receiver.done()?.sha256Verified).toBe(true);
    expect(new TextDecoder().decode(assembled)).toBe("the full evidence bundle");
    expect(receiver.progress().percent).toBe(100);
  });

  it("flags corruption (tampered chunk)", async () => {
    const prep = await prepareFileTransfer({ name: "x", mime: "", size: 100 }, bytesOf("a".repeat(100)));
    const receiver = new FileReceiver();
    receiver.setKey(prep.keyB64);
    receiver.feedControl(buildInitFrame(prep.meta));
    const enc = await encryptChunk(prep.chunks[0], prep.keyB64);
    enc[0] ^= 0xff; // corrupt the IV → decrypt fails
    receiver.feedBinary(enc.buffer as ArrayBuffer);
    receiver.feedControl(buildDoneFrame(prep.meta));
    await receiver.whenComplete();
    expect(receiver.getState()).toBe("error");
  });

  it("aborts cleanly mid-transfer", async () => {
    const prep = await prepareFileTransfer({ name: "x", mime: "", size: 2 }, bytesOf("ab"));
    const receiver = new FileReceiver();
    receiver.setKey(prep.keyB64);
    receiver.feedControl(buildInitFrame(prep.meta));
    receiver.feedControl(buildAbortFrame(prep.meta.id));
    await receiver.whenComplete();
    expect(receiver.getState()).toBe("aborted");
    expect(receiver.done()).toBeNull();
  });

  it("ignores a second init while receiving", async () => {
    const a = await prepareFileTransfer({ name: "a", mime: "", size: 2 }, bytesOf("aa"));
    const b = await prepareFileTransfer({ name: "b", mime: "", size: 2 }, bytesOf("bb"));
    const receiver = new FileReceiver();
    receiver.setKey(a.keyB64);
    receiver.feedControl(buildInitFrame(a.meta));
    receiver.feedControl(buildInitFrame(b.meta)); // ignored
    receiver.feedBinary((await encryptChunk(a.chunks[0], a.keyB64)).buffer as ArrayBuffer);
    receiver.feedControl(buildDoneFrame(a.meta));
    await receiver.whenComplete();
    expect(receiver.getMeta()?.name).toBe("a");
    expect(receiver.done()?.assembled.length).toBe(2);
  });
});

describe("control frames", () => {
  it("parses and rejects", () => {
    const meta = {
      id: "abc",
      name: "f",
      mime: "m",
      size: 10,
      chunkSize: 8192,
      chunkCount: 1,
      sha256: "0".repeat(64),
    };
    const init = buildInitFrame(meta);
    expect(isFileControl(init)).toBe(true);
    expect(isFileControl("{\"x\":1}")).toBe(false);
    const p = parseFileControl(init);
    expect(p?.kind).toBe("init");
    expect(p?.meta?.name).toBe("f");
    expect(parseFileControl(buildDoneFrame(meta))?.kind).toBe("done");
    expect(parseFileControl(buildAbortFrame("abc"))).toEqual({ kind: "abort", id: "abc" });
    expect(parseFileControl("VFXFILE1:bogus|1")).toBeNull();
    expect(parseFileControl("")).toBeNull();
  });
});

describe("dead-drop file records", () => {
  it("encrypts, stores, and decrypts a full file", async () => {
    const data: Uint8Array<ArrayBuffer> = new Uint8Array(25_000).map((_, i) => i % 256);
    const prep = await prepareFileTransfer({ name: "leak.zip", mime: "application/zip", size: data.length }, data);
    const encryptedChunks: Uint8Array<ArrayBuffer>[] = [];
    for (const c of prep.chunks) encryptedChunks.push(await encryptChunk(c, prep.keyB64));
    const record = await buildDeadDropFileRecord({
      id: "dd1",
      lat: "31.5",
      lng: "34.5",
      meta: prep.meta,
      encryptedChunks,
      keyB64: prep.keyB64,
      ts: 123,
      author: "V-ABCD",
    });
    expect(record.kind).toBe("file");
    expect(record.meta.sha256).toBe(prep.meta.sha256);
    expect(record.payloadChunksB64.length).toBe(prep.meta.chunkCount);
    const plain = await decryptDeadDropFile(record);
    expect(Array.from(plain)).toEqual(Array.from(data));
  });
});

describe("sliceFile", () => {
  it("reads a blob slice as bytes", async () => {
    const blob = new Blob([bytesOf("0123456789")]);
    expect(new TextDecoder().decode(await sliceFile(blob, 2, 5))).toBe("234");
  });
});
