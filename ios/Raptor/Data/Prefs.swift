import Foundation
import SwiftUI

/// Espelho do SharedPreferences `raptor_session` do Android.
final class Prefs {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private struct StoredSession: Codable {
        var mode: String
        var base: String
        var user: String
        var pass: String
        var m3u: String
        var label: String
    }

    private struct StoredEntry: Codable {
        var id: String
        var name: String
        var logo: String
        var cat: String
        var kind: String
        var ext: String
        var url: String
    }

    // MARK: - Listas

    func savedLists() -> [Session] {
        guard let data = defaults.data(forKey: "lists"),
              let raw = try? JSONDecoder().decode([StoredSession].self, from: data) else { return [] }
        return raw.map { item in
            let mode: LoginMode = (item.mode == "LINK" || item.mode == "M3U" || item.mode == "link") ? .link : .service
            return Session(
                mode: mode,
                baseUrl: item.base,
                username: item.user,
                password: item.pass,
                linkUrl: item.m3u,
                label: item.label
            )
        }
    }

    func saveList(_ session: Session) {
        var lists = savedLists()
        let key = session.key()
        lists.removeAll { $0.key() == key }
        var toStore = session
        if toStore.label.trimmingCharacters(in: .whitespaces).isEmpty {
            toStore.label = toStore.displayName()
        }
        lists.insert(toStore, at: 0)
        if lists.count > 20 { lists = Array(lists.prefix(20)) }
        let raw = lists.map { s in
            StoredSession(
                mode: s.mode == .service ? "SERVICE" : "LINK",
                base: s.baseUrl, user: s.username, pass: s.password,
                m3u: s.linkUrl, label: s.label
            )
        }
        if let data = try? JSONEncoder().encode(raw) {
            defaults.set(data, forKey: "lists")
        }
    }

    func removeList(_ session: Session) {
        var lists = savedLists().filter { $0.key() != session.key() }
        if lists.count > 20 { lists = Array(lists.prefix(20)) }
        let raw = lists.map { s in
            StoredSession(
                mode: s.mode == .service ? "SERVICE" : "LINK",
                base: s.baseUrl, user: s.username, pass: s.password,
                m3u: s.linkUrl, label: s.label
            )
        }
        if let data = try? JSONEncoder().encode(raw) { defaults.set(data, forKey: "lists") }
        if currentKey() == session.key() { setCurrent(nil) }
    }

    func current() -> Session? {
        guard let key = currentKey(), !key.isEmpty else { return nil }
        return savedLists().first { $0.key() == key }
    }

    func currentKey() -> String? {
        defaults.string(forKey: "last")
    }

    func setCurrent(_ session: Session?) {
        if let session { defaults.set(session.key(), forKey: "last") }
        else { defaults.removeObject(forKey: "last") }
    }

    // MARK: - Termos

    func acceptedTermsVersion() -> Int {
        defaults.integer(forKey: "terms_version")
    }

    func acceptTerms(_ version: Int) {
        defaults.set(version, forKey: "terms_version")
    }

    // MARK: - Código do aparelho

    func deviceCode() -> String? {
        defaults.string(forKey: "device_code")
    }

    func setDeviceCode(_ code: String) {
        defaults.set(code, forKey: "device_code")
    }

    // MARK: - Favoritos e recentes

    func favorites() -> [MediaEntry] { readEntries("favorites") }
    func recents() -> [MediaEntry] { readEntries("recents") }

    func isFavorite(_ entry: MediaEntry) -> Bool {
        favorites().contains { $0.kind == entry.kind && $0.id == entry.id }
    }

    func toggleFavorite(_ entry: MediaEntry) {
        var list = favorites()
        if let idx = list.firstIndex(where: { $0.kind == entry.kind && $0.id == entry.id }) {
            list.remove(at: idx)
        } else {
            list.insert(entry, at: 0)
            if list.count > 500 { list = Array(list.prefix(500)) }
        }
        writeEntries(list, forKey: "favorites")
    }

    func addRecent(_ entry: MediaEntry) {
        var list = recents().filter { !($0.kind == entry.kind && $0.id == entry.id) }
        list.insert(entry, at: 0)
        if list.count > 60 { list = Array(list.prefix(60)) }
        writeEntries(list, forKey: "recents")
    }

    private func readEntries(_ key: String) -> [MediaEntry] {
        guard let data = defaults.data(forKey: key),
              let raw = try? JSONDecoder().decode([StoredEntry].self, from: data) else { return [] }
        return raw.compactMap { item in
            guard !item.id.isEmpty else { return nil }
            let kind = MediaKind(rawValue: item.kind) ?? .live
            return MediaEntry(
                id: item.id,
                name: item.name,
                logo: item.logo.isEmpty ? nil : item.logo,
                categoryId: item.cat.isEmpty ? nil : item.cat,
                kind: kind,
                containerExtension: item.ext.isEmpty ? nil : item.ext,
                directUrl: item.url.isEmpty ? nil : item.url
            )
        }
    }

    private func writeEntries(_ entries: [MediaEntry], forKey key: String) {
        let raw = entries.map { e in
            StoredEntry(
                id: e.id, name: e.name, logo: e.logo ?? "", cat: e.categoryId ?? "",
                kind: e.kind.rawValue, ext: e.containerExtension ?? "", url: e.directUrl ?? ""
            )
        }
        if let data = try? JSONEncoder().encode(raw) { defaults.set(data, forKey: key) }
    }

    // MARK: - Retomada

    func resumeFor(_ url: String) -> Int64 {
        Int64(defaults.integer(forKey: "pos:\(RaptorUtil.javaHash(url))"))
    }

    func saveResume(_ url: String, position: Int64) {
        guard position > 0 else { return }
        defaults.set(position, forKey: "pos:\(RaptorUtil.javaHash(url))")
    }

    func clearResume(_ url: String) {
        defaults.removeObject(forKey: "pos:\(RaptorUtil.javaHash(url))")
    }
}
