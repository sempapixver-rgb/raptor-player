import SwiftUI

private let seriesPageSize = 60

struct SeriesScreen: View {
    @EnvironmentObject private var store: RaptorStore
    @Binding var route: PlayerRoute?

    @State private var categories: [Category] = []
    @State private var selectedCategory: String?
    @State private var items: [MediaEntry] = []
    @State private var query = ""
    @State private var filter = 0
    @State private var loading = true
    @State private var errorMessage = ""
    @State private var page = 0
    @State private var selectedSeries: MediaEntry?
    @State private var showDetail = false

    private let filters = ["Todos", "Favoritos", "Recentes"]
    private let columns = UIDevice.current.userInterfaceIdiom == .pad ? 5 : 3

    var body: some View {
        NavigationStack {
            ZStack {
                VStack(spacing: 8) {
                    SearchField(text: $query, placeholder: "Buscar séries")
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                    Picker("Filtro", selection: $filter) {
                        ForEach(0..<filters.count, id: \.self) { Text(filters[$0]) }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)

                    CategoryChips(categories: categories, selected: $selectedCategory)

                    if loading {
                        StateView(.loading("Carregando séries…"))
                    } else if !errorMessage.isEmpty {
                        StateView(.error(errorMessage)) { Task { await load() } }
                    } else if displayed.isEmpty {
                        StateView(.empty(emptyMessage))
                    } else {
                        ScrollView {
                            PosterGrid(columns: columns, items: displayed) { entry in
                                poster(entry)
                            }
                            if filtered.count > seriesPageSize {
                                PagerBar(page: page, total: totalPages,
                                         onPrevious: { page = max(0, page - 1) },
                                         onNext: { page = min(totalPages - 1, page + 1) })
                            }
                        }
                    }
                }
            }
            .navigationTitle("Séries")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showDetail) {
                if let selectedSeries {
                    SeriesDetailView(entry: selectedSeries, route: $route)
                }
            }
        }
        .task { await load() }
        .onChange(of: selectedCategory) { _ in page = 0; Task { await loadItems() } }
        .onChange(of: query) { _ in page = 0 }
        .onChange(of: store.favorites) { _ in Task { await loadItems() } }
    }

    private var filtered: [MediaEntry] {
        let base: [MediaEntry]
        if filter == 1 {
            base = store.favorites.filter { $0.kind == .series }
        } else if filter == 2 {
            base = store.recents.filter { $0.kind == .series }
        } else {
            let searchIndex = query.count >= 2 ? store.searchCache[.series] : nil
            base = (searchIndex ?? items).filter {
                selectedCategory == nil || $0.allCategoryIds().contains(selectedCategory!)
            }
        }
        let needle = query.trimmingCharacters(in: .whitespaces)
        return needle.isEmpty ? base : base.filter { $0.name.localizedCaseInsensitiveContains(needle) }
    }

    private var displayed: [MediaEntry] {
        let start = min(page * seriesPageSize, max(0, filtered.count - 1))
        return Array(filtered.dropFirst(start).prefix(seriesPageSize))
    }

    private var totalPages: Int { max(1, Int(ceil(Double(filtered.count) / Double(seriesPageSize)))) }

    private var emptyMessage: String {
        if !query.isEmpty { return "Nenhum resultado para \"\(query)\"." }
        if filter == 1 { return "Nenhuma série favorita." }
        if filter == 2 { return "Nenhuma série vista ainda." }
        return "Nenhuma série nesta categoria."
    }

    private func load() async {
        loading = true
        errorMessage = ""
        let cats = await store.categories(.series)
        await MainActor.run { categories = cats }
        await loadItems()
        await MainActor.run { loading = false }
    }

    private func loadItems() async {
        let result = await store.items(.series, categoryId: selectedCategory)
        await MainActor.run { items = result }
        if query.count >= 2 {
            let all = await store.allItems(.series)
            await MainActor.run { store.searchCache[.series] = all }
        }
    }

    @ViewBuilder
    private func poster(_ entry: MediaEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            CoverImage(url: entry.logo)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(store.isFavorite(entry) ? RaptorColor.green : RaptorColor.outline, lineWidth: 1)
                )
                .onTapGesture {
                    selectedSeries = entry
                    showDetail = true
                }
            HStack(spacing: 4) {
                Text(entry.name)
                    .font(.caption)
                    .lineLimit(2)
                    .foregroundStyle(RaptorColor.text)
                Spacer(minLength: 0)
                Button { store.toggleFavorite(entry) } label: {
                    Image(systemName: store.isFavorite(entry) ? "star.fill" : "star")
                        .font(.caption)
                        .foregroundStyle(store.isFavorite(entry) ? Color(red: 1, green: 0.76, blue: 0.07) : RaptorColor.dim)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Detalhe da série

struct SeriesDetailView: View {
    @EnvironmentObject private var store: RaptorStore
    let entry: MediaEntry
    @Binding var route: PlayerRoute?

    @State private var detail: SeriesDetail?
    @State private var loading = true
    @State private var errorMessage = ""
    @State private var season: Int = 1
    @State private var autoStarted = false

    private var episodes: [Episode] {
        detail?.seasons.first { $0.number == season }?.episodes ?? []
    }

    var body: some View {
        Group {
            if loading {
                StateView(.loading("Carregando temporadas e episódios…"))
            } else if !errorMessage.isEmpty {
                StateView(.error(errorMessage)) { Task { await load() } }
            } else if let detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .top, spacing: 12) {
                            CoverImage(url: detail.cover ?? entry.logo, ratio: 2.0 / 3.0)
                                .frame(width: 110)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            VStack(alignment: .leading, spacing: 6) {
                                Text(detail.name)
                                    .font(.headline)
                                    .foregroundStyle(RaptorColor.text)
                                if let genre = detail.displayGenre ?? detail.genre {
                                    Text(genre).font(.caption).foregroundStyle(RaptorColor.dim)
                                }
                                if let year = detail.releaseDate {
                                    Text(year).font(.caption).foregroundStyle(RaptorColor.dim)
                                }
                                if let rating = detail.rating, rating > 0 {
                                    Text("★ \(String(format: "%.1f", rating))")
                                        .font(.caption)
                                        .foregroundStyle(Color(red: 1, green: 0.76, blue: 0.07))
                                }
                                Text("\(detail.seasons.count) temporada(s) · \(detail.seasons.reduce(0) { $0 + $1.episodes.count }) episódios")
                                    .font(.caption2)
                                    .foregroundStyle(RaptorColor.dim)
                            }
                        }

                        if let plot = detail.plot, !plot.isEmpty {
                            Text(plot)
                                .font(.caption)
                                .foregroundStyle(RaptorColor.dim)
                                .lineLimit(4)
                        }

                        Button {
                            store.toggleFavorite(entry)
                        } label: {
                            Label(store.isFavorite(entry) ? "Favorito" : "Favoritar",
                                  systemImage: store.isFavorite(entry) ? "star.fill" : "star")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(RaptorColor.green)

                        if detail.seasons.isEmpty {
                            StateView(.empty("Esta série não tem episódios disponíveis na lista."))
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(detail.seasons) { item in
                                        Button("T\(item.number) · \(item.episodes.count) ep.") {
                                            season = item.number
                                        }
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                        .background(season == item.number ? RaptorColor.green.opacity(0.18) : RaptorColor.surfaceHigh)
                                        .foregroundStyle(season == item.number ? RaptorColor.green : RaptorColor.dim)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(season == item.number ? RaptorColor.green : RaptorColor.outline, lineWidth: 1))
                                    }
                                }
                            }

                            SectionLabel(text: "EPISÓDIOS · TEMPORADA \(season)")
                            ForEach(episodes) { episode in
                                Button {
                                    play(episode, detail: detail)
                                } label: {
                                    HStack(spacing: 10) {
                                        Text("\(episode.number)")
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(RaptorColor.green)
                                            .frame(width: 26)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(episode.title)
                                                .font(.subheadline)
                                                .lineLimit(1)
                                            Text("T\(episode.season) E\(episode.number)\(episode.duration.map { " · \($0)" } ?? "")")
                                                .font(.caption2)
                                                .foregroundStyle(RaptorColor.dim)
                                        }
                                        Spacer()
                                        Image(systemName: "play.circle.fill")
                                            .foregroundStyle(RaptorColor.green)
                                    }
                                    .padding(10)
                                    .background(RaptorColor.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(16)
                }
            } else {
                StateView(.empty("Não foi possível abrir esta série."))
            }
        }
        .raptorScreen()
        .navigationTitle(entry.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loading = true
        errorMessage = ""
        guard let result = await store.seriesDetail(entry.id) else {
            await MainActor.run { loading = false; errorMessage = "Não foi possível abrir esta série." }
            return
        }
        let firstSeason = result.seasons.first?.number ?? 1
        await MainActor.run {
            detail = result
            season = firstSeason
            loading = false
        }
    }

    private func play(_ episode: Episode, detail: SeriesDetail) {
        let all = detail.seasons.flatMap { $0.episodes }
        let queue = all.filter { !$0.url.isEmpty }.map { item in
            PlayItem(url: item.url, title: "\(detail.name) · T\(item.season)E\(item.number) · \(item.title)")
        }
        guard !queue.isEmpty,
              let index = queue.firstIndex(where: { $0.url == episode.url }) else { return }
        store.addRecent(entry)
        route = PlayerRoute(items: queue, startIndex: index, autoAdvance: true)
    }
}
