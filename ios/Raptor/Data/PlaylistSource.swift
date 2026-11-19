import Foundation

protocol PlaylistSource {
    func check() async -> String
    func categories(_ kind: MediaKind) async -> [Category]
    func items(_ kind: MediaKind, categoryId: String?) async -> [MediaEntry]
    func seriesDetail(_ id: String) async -> SeriesDetail?
    func playUrl(_ entry: MediaEntry) async -> String?
    func account() async -> AccountInfo?
}

// MARK: - Xtream

final class XtreamSource: PlaylistSource {
    private let client: XtreamClient

    init(session: Session) {
        client = XtreamClient(session: session)
    }

    func check() async -> String { await client.check() }
    func account() async -> AccountInfo? { await client.account() }
    func categories(_ kind: MediaKind) async -> [Category] { await client.categories(kind) }
    func items(_ kind: MediaKind, categoryId: String?) async -> [MediaEntry] {
        await client.items(kind, categoryId: categoryId)
    }
    func seriesDetail(_ id: String) async -> SeriesDetail? { await client.seriesDetail(id) }

    func playUrl(_ entry: MediaEntry) async -> String? {
        switch entry.kind {
        case .live: return client.liveUrl(entry)
        case .vod: return client.vodUrl(entry)
        case .series: return nil
        }
    }

    func episodeUrl(_ episode: Episode) -> String { episode.url }
}

// MARK: - M3U

final class M3uSource: PlaylistSource {
    private let session: Session
    private var entries: [MediaEntry] = []
    private var series: [SeriesDetail] = []
    private var loaded = false
    private var workingUrl: String

    init(session: Session) {
        self.session = session
        self.workingUrl = RaptorUtil.normalizeRemoteUrl(session.linkUrl)
    }

    private func load() async {
        guard !loaded else { return }
        loaded = true
        var text = ""
        let raw = session.linkUrl.trimmingCharacters(in: .whitespacesAndNewlines)

        if raw.hasPrefix("file:") || (!raw.contains("://") && raw.hasPrefix("/")) {
            let path = raw.replacingOccurrences(of: "file://", with: "")
            text = (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
        } else if let url = URL(string: workingUrl) {
            do {
                var request = URLRequest(url: url)
                request.timeoutInterval = 45
                request.setValue("Raptor/1.2 (iOS)", forHTTPHeaderField: "User-Agent")
                let (data, _) = try await URLSession.shared.data(for: request)
                text = String(data: data, encoding: .utf8)
                    ?? String(data: data, encoding: .isoLatin1) ?? ""
            } catch {
                if workingUrl.hasPrefix("https://") {
                    workingUrl = workingUrl.replacingOccurrences(of: "https://", with: "http://")
                    if let fallback = URL(string: workingUrl),
                       let (data, _) = try? await URLSession.shared.data(from: fallback) {
                        text = String(data: data, encoding: .utf8) ?? ""
                    }
                }
            }
        }
        entries = M3uParser.parse(text)
        series = M3uSeries.build(from: entries)
    }

    func check() async -> String {
        await load()
        return entries.isEmpty ? "Playlist vazia ou inválida" : ""
    }

    func account() async -> AccountInfo? { nil }

    func categories(_ kind: MediaKind) async -> [Category] {
        await load()
        if kind == .series {
            let names = Set(series.flatMap { $0.allGenres() }).sorted { $0.lowercased() < $1.lowercased() }
            return names.map { Category(id: $0, name: $0) }
        }
        var seen: [String] = []
        for entry in entries where entry.kind == kind {
            if let cat = entry.categoryId, !cat.isEmpty, !seen.contains(cat) { seen.append(cat) }
        }
        return seen.map { Category(id: $0, name: $0) }
    }

    func items(_ kind: MediaKind, categoryId: String?) async -> [MediaEntry] {
        await load()
        if kind == .series {
            return series.compactMap { detail in
                guard categoryId == nil || detail.allGenres().contains(categoryId!) else { return nil }
                return MediaEntry(
                    id: detail.id,
                    name: detail.name,
                    logo: detail.cover,
                    categoryId: categoryId ?? detail.genres.first,
                    kind: .series,
                    rating: detail.rating,
                    plot: detail.plot,
                    categoryIds: detail.allGenres()
                )
            }.sorted { $0.name.lowercased() < $1.name.lowercased() }
        }
        return entries.filter { entry in
            entry.kind == kind && (categoryId == nil || entry.categoryId == categoryId)
        }
    }

    func seriesDetail(_ id: String) async -> SeriesDetail? {
        await load()
        return series.first { $0.id == id }
    }

    func playUrl(_ entry: MediaEntry) async -> String? {
        await load()
        return entry.directUrl
    }
}

func makeSource(_ session: Session) -> PlaylistSource {
    switch session.mode {
    case .service: return XtreamSource(session: session)
    case .link: return M3uSource(session: session)
    }
}
