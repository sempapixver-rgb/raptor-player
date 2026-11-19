import Foundation

/// Cliente Xtream Codes (player_api.php), equivalente ao XtreamClient.kt.
final class XtreamClient {
    private let session: Session
    private var workingBase: String

    init(session: Session) {
        self.session = session
        self.workingBase = session.normalizedBase()
    }

    private func base() -> String { workingBase }

    private func apiURL(_ action: String?, extra: [String: String] = [:]) -> URL? {
        var s = "\(base())/player_api.php?username=\(RaptorUtil.enc(session.username))&password=\(RaptorUtil.enc(session.password))"
        if let action, !action.isEmpty { s += "&action=\(action)" }
        for (key, value) in extra {
            s += "&\(key)=\(RaptorUtil.enc(value))"
        }
        return URL(string: s)
    }

    /// Faz GET; se falhar em https, tenta http e promove a base (como no Android).
    private func getString(_ url: URL) async throws -> String {
        do {
            return try await fetch(url)
        } catch {
            if url.scheme?.lowercased() == "https",
               var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
                comps.scheme = "http"
                if let fallback = comps.url {
                    workingBase = workingBase.replacingOccurrences(of: "https://", with: "http://")
                    return try await fetch(fallback)
                }
            }
            throw error
        }
    }

    private func fetch(_ url: URL) async throws -> String {
        var request = URLRequest(url: url)
        request.timeoutInterval = 45
        request.setValue("Raptor/1.2 (iOS)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<400).contains(http.statusCode) else {
            throw NSError(domain: "Xtream", code: 2, userInfo: [NSLocalizedDescriptionKey: "Servidor recusou a conexão"])
        }
        return String(data: data, encoding: .utf8)
            ?? String(data: data, encoding: .isoLatin1)
            ?? ""
    }

    private func jsonObject(_ text: String) -> [String: Any]? {
        try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any]
    }

    private func jsonArray(_ text: String) -> [[String: Any]] {
        if let array = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [[String: Any]] {
            return array
        }
        if let obj = jsonObject(text), let array = obj["categories"] as? [[String: Any]] {
            return array
        }
        return []
    }

    private func string(_ value: Any?) -> String {
        if let s = value as? String { return s }
        if let n = value as? NSNumber { return n.stringValue }
        return ""
    }

    // MARK: - API

    func check() async -> String {
        guard let url = apiURL(nil) else { return "Não foi possível montar a URL" }
        do {
            let text = try await getString(url)
            guard let obj = jsonObject(text), let info = obj["user_info"] as? [String: Any] else {
                return "Usuário ou senha inválidos"
            }
            let status = string(info["status"]).lowercased()
            if ["disabled", "banned", "expired"].contains(status) {
                let message = string(obj["message"])
                return message.isEmpty ? "Conta \(status)" : message
            }
            return ""
        } catch {
            return errorMessage(error)
        }
    }

    func account() async -> AccountInfo? {
        guard let url = apiURL(nil),
              let text = try? await getString(url),
              let obj = jsonObject(text),
              let info = obj["user_info"] as? [String: Any] else { return nil }
        return AccountInfo(
            username: string(info["username"]),
            status: string(info["status"]),
            expiresAt: string(info["exp_date"]),
            maxConnections: string(info["max_connections"]),
            activeConnections: string(info["active_cons"]),
            isTrial: string(info["is_trial"]) == "1"
        )
    }

    func categories(_ kind: MediaKind) async -> [Category] {
        let action: String
        switch kind {
        case .live: action = "get_live_categories"
        case .vod: action = "get_vod_categories"
        case .series: action = "get_series_categories"
        }
        guard let url = apiURL(action), let text = try? await getString(url) else { return [] }
        return jsonArray(text).compactMap { obj in
            let id = string(obj["category_id"])
            guard !id.isEmpty else { return nil }
            let name = string(obj["category_name"])
            return Category(id: id, name: name.isEmpty ? "Sem nome" : name)
        }
    }

    func items(_ kind: MediaKind, categoryId: String?) async -> [MediaEntry] {
        let action: String
        switch kind {
        case .live: action = "get_live_streams"
        case .vod: action = "get_vod_streams"
        case .series: action = "get_series"
        }
        var extra: [String: String] = [:]
        if let categoryId, !categoryId.isEmpty { extra["category_id"] = categoryId }
        guard let url = apiURL(action, extra: extra), let text = try? await getString(url) else { return [] }

        let idKey = kind == .series ? "series_id" : "stream_id"
        let logoKey = kind == .series ? "cover" : "stream_icon"
        return jsonArray(text).compactMap { obj in
            let id = string(obj[idKey])
            guard !id.isEmpty else { return nil }
            let name = string(obj["name"])
            let ratingText = string(obj["rating"])
            return MediaEntry(
                id: id,
                name: name.isEmpty ? "Sem título" : name,
                logo: nonEmpty(string(obj[logoKey])),
                categoryId: nonEmpty(string(obj["category_id"])),
                kind: kind,
                containerExtension: nonEmpty(string(obj["container_extension"])),
                directUrl: nil,
                rating: Double(ratingText),
                plot: nil,
                year: nonEmpty(string(obj["year"]))
            )
        }
    }

    func seriesDetail(_ id: String) async -> SeriesDetail? {
        guard let url = apiURL("get_series_info", extra: ["series_id": id]),
              let text = try? await getString(url),
              let obj = jsonObject(text) else { return nil }
        let info = obj["info"] as? [String: Any] ?? [:]
        let name = string(info["name"])
        var episodes: [Episode] = []

        if let map = obj["episodes"] as? [String: Any] {
            for (seasonKey, raw) in map {
                let seasonFromKey = Int(seasonKey) ?? 1
                guard let list = raw as? [[String: Any]] else { continue }
                for ep in list {
                    episodes.append(parseEpisode(ep, fallbackSeason: seasonFromKey))
                }
            }
        }
        if episodes.isEmpty, let list = obj["episodes"] as? [[String: Any]] {
            for ep in list { episodes.append(parseEpisode(ep, fallbackSeason: 1)) }
        }

        let grouped = Dictionary(grouping: episodes) { $0.season }
        let seasons = grouped.keys.sorted().map { number in
            Season(number: number, episodes: (grouped[number] ?? []).sorted {
                if $0.number != $1.number { return $0.number < $1.number }
                return $0.title.lowercased() < $1.title.lowercased()
            })
        }

        return SeriesDetail(
            id: id,
            name: name.isEmpty ? "Série" : name,
            cover: nonEmpty(string(info["cover"])),
            plot: nonEmpty(string(info["plot"])),
            cast: nonEmpty(string(info["cast"])),
            genre: nonEmpty(string(info["genre"])),
            releaseDate: nonEmpty(string(info["releaseDate"])),
            rating: Double(string(info["rating"])),
            seasons: seasons
        )
    }

    private func parseEpisode(_ ep: [String: Any], fallbackSeason: Int) -> Episode {
        let info = ep["info"] as? [String: Any] ?? [:]
        let id = string(ep["id"])
        let ext = nonEmpty(string(ep["container_extension"])) ?? "mp4"
        let season = max(1, Int(string(ep["season"])) ?? fallbackSeason)
        let number = max(0, Int(string(ep["episode_num"])) ?? 0)
        var title = nonEmpty(string(info["name"])) ?? string(ep["title"])
        if title.isEmpty { title = "Episódio \(number)" }
        let url = "\(base())/series/\(RaptorUtil.enc(session.username))/\(RaptorUtil.enc(session.password))/\(id).\(ext)"
        return Episode(
            id: id, title: title, season: season, number: number, url: url,
            plot: nonEmpty(string(info["plot"])),
            duration: nonEmpty(string(info["duration"])),
            logo: nonEmpty(string(info["movie_image"]))
        )
    }

    // MARK: - URLs de mídia

    func liveUrl(_ entry: MediaEntry) -> String {
        "\(base())/live/\(RaptorUtil.enc(session.username))/\(RaptorUtil.enc(session.password))/\(entry.id).m3u8"
    }

    func vodUrl(_ entry: MediaEntry) -> String {
        let ext = entry.containerExtension ?? "mp4"
        return "\(base())/movie/\(RaptorUtil.enc(session.username))/\(RaptorUtil.enc(session.password))/\(entry.id).\(ext)"
    }

    private func nonEmpty(_ value: String) -> String? {
        value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : value
    }

    private func errorMessage(_ error: Error) -> String {
        let ns = error as NSError
        if ns.code == NSURLErrorCannotConnectToHost || ns.code == NSURLErrorTimedOut {
            return "Não foi possível conectar ao servidor"
        }
        return ns.localizedDescription
    }
}
