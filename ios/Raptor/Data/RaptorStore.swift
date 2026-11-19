import Foundation
import SwiftUI

/// Estado global do app (equivalente ao conjunto Prefs + ContentStore + HomeScreen).
@MainActor
final class RaptorStore: ObservableObject {
    let prefs: Prefs

    @Published var lists: [Session] = []
    @Published var current: Session?
    @Published var termsAccepted: Bool
    @Published var favorites: [MediaEntry] = []
    @Published var recents: [MediaEntry] = []
    @Published var account: AccountInfo?
    /// Índice de busca sob demanda por aba (equivalente ao searchIndex do ContentStore).
    @Published var searchCache: [MediaKind: [MediaEntry]] = [:]

    private var categoriesCache: [String: [Category]] = [:]
    private var itemsCache: [String: [MediaEntry]] = [:]
    private var sourceCache: [String: PlaylistSource] = [:]

    init(prefs: Prefs = Prefs()) {
        self.prefs = prefs
        self.lists = prefs.savedLists()
        self.current = prefs.current()
        self.termsAccepted = prefs.acceptedTermsVersion() >= 2
        self.favorites = prefs.favorites()
        self.recents = prefs.recents()
    }

    func source(_ session: Session? = nil) -> PlaylistSource? {
        let target = session ?? current
        guard let target else { return nil }
        let key = target.key()
        if let cached = sourceCache[key] { return cached }
        let created = makeSource(target)
        sourceCache[key] = created
        return created
    }

    func login(_ session: Session) {
        prefs.saveList(session)
        prefs.setCurrent(session)
        lists = prefs.savedLists()
        current = session
    }

    func switchList() {
        prefs.setCurrent(nil)
        current = nil
        clearCaches()
        account = nil
    }

    func removeList(_ session: Session) {
        prefs.removeList(session)
        lists = prefs.savedLists()
        if current?.key() == session.key() {
            current = nil
            clearCaches()
        }
    }

    func acceptTerms(_ version: Int = 2) {
        prefs.acceptTerms(version)
        termsAccepted = true
    }

    func clearCaches() {
        categoriesCache.removeAll()
        itemsCache.removeAll()
        sourceCache.removeAll()
        searchCache.removeAll()
    }

    func refreshCatalog() {
        clearCaches()
        favorites = prefs.favorites()
        recents = prefs.recents()
    }

    // MARK: - Catálogo

    private func categoryKey(_ kind: MediaKind, _ session: Session) -> String {
        "\(session.key())|CAT|\(kind.rawValue)"
    }

    private func itemKey(_ kind: MediaKind, _ categoryId: String?, _ session: Session) -> String {
        "\(session.key())|ITEMS|\(kind.rawValue)|\(categoryId ?? "")"
    }

    func categories(_ kind: MediaKind, force: Bool = false) async -> [Category] {
        guard let session = current, let source = source(session) else { return [] }
        let key = categoryKey(kind, session)
        if !force, let cached = categoriesCache[key] { return cached }
        let result = await source.categories(kind)
        if !result.isEmpty { categoriesCache[key] = result }
        return result
    }

    func items(_ kind: MediaKind, categoryId: String?, force: Bool = false) async -> [MediaEntry] {
        guard let session = current, let source = source(session) else { return [] }
        let key = itemKey(kind, categoryId, session)
        if !force, let cached = itemsCache[key] { return cached }
        let result = await source.items(kind, categoryId: categoryId)
        if !result.isEmpty { itemsCache[key] = result }
        return result
    }

    /// Índice de busca sob demanda (todas as pastas), como no Android.
    func allItems(_ kind: MediaKind) async -> [MediaEntry] {
        guard let session = current, let source = source(session) else { return [] }
        return await source.items(kind, categoryId: nil)
    }

    func seriesDetail(_ id: String) async -> SeriesDetail? {
        guard let source = source() else { return nil }
        return await source.seriesDetail(id)
    }

    func playUrl(_ entry: MediaEntry) async -> String? {
        guard let source = source() else { return nil }
        return await source.playUrl(entry)
    }

    func checkAccount() async {
        guard let source = source() else { return }
        account = await source.account()
    }

    // MARK: - Favoritos, histórico e retomada

    func isFavorite(_ entry: MediaEntry) -> Bool {
        favorites.contains { $0.kind == entry.kind && $0.id == entry.id }
    }

    func toggleFavorite(_ entry: MediaEntry) {
        prefs.toggleFavorite(entry)
        favorites = prefs.favorites()
    }

    func addRecent(_ entry: MediaEntry) {
        prefs.addRecent(entry)
        recents = prefs.recents()
    }

    func clearFavorites() {
        UserDefaults.standard.removeObject(forKey: "favorites")
        favorites = []
    }

    func clearRecents() {
        UserDefaults.standard.removeObject(forKey: "recents")
        recents = []
    }

    func resumeFor(_ url: String) -> Int64 { prefs.resumeFor(url) }

    func saveResume(_ url: String, position: Int64) {
        prefs.saveResume(url, position: position)
    }
}
