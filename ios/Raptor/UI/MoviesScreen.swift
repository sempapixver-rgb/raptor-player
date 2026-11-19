import SwiftUI

private let moviePageSize = 60

enum SortMode: String, CaseIterable {
    case `default` = "Padrão"
    case nameAsc = "Nome A-Z"
    case nameDesc = "Nome Z-A"
    case rating = "Melhor nota"
}

struct MoviesScreen: View {
    @EnvironmentObject private var store: RaptorStore
    @Binding var route: PlayerRoute?

    @State private var categories: [Category] = []
    @State private var selectedCategory: String?
    @State private var items: [MediaEntry] = []
    @State private var query = ""
    @State private var filter = 0
    @State private var sort: SortMode = .default
    @State private var loading = true
    @State private var errorMessage = ""
    @State private var page = 0
    @State private var resolving = false

    private let filters = ["Todos", "Favoritos", "Recentes"]
    private let columns = UIDevice.current.userInterfaceIdiom == .pad ? 5 : 3

    var body: some View {
        ZStack {
            VStack(spacing: 8) {
                SearchField(text: $query, placeholder: "Buscar filmes")
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                HStack(spacing: 8) {
                    Picker("Filtro", selection: $filter) {
                        ForEach(0..<filters.count, id: \.self) { Text(filters[$0]) }
                    }
                    .pickerStyle(.segmented)

                    Menu {
                        ForEach(SortMode.allCases, id: \.self) { mode in
                            Button(mode.rawValue) { sort = mode }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                            .padding(8)
                            .background(RaptorColor.surfaceHigh)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(RaptorColor.green)
                    }
                }
                .padding(.horizontal, 16)

                CategoryChips(categories: categories, selected: $selectedCategory, showAll: false)

                Text(countText)
                    .font(.caption2)
                    .foregroundStyle(RaptorColor.dim)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)

                if loading {
                    StateView(.loading("Carregando filmes…"))
                } else if !errorMessage.isEmpty {
                    StateView(.error(errorMessage)) { Task { await load() } }
                } else if displayed.isEmpty {
                    StateView(.empty(emptyMessage))
                } else {
                    ScrollView {
                        PosterGrid(columns: columns, items: displayed) { entry in
                            poster(entry)
                        }
                        if filtered.count > moviePageSize {
                            PagerBar(page: page, total: totalPages,
                                     onPrevious: { page = max(0, page - 1) },
                                     onNext: { page = min(totalPages - 1, page + 1) })
                        }
                    }
                }
            }

            if resolving {
                ZStack {
                    Color.black.opacity(0.6).ignoresSafeArea()
                    ProgressView().tint(RaptorColor.green)
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
            base = store.favorites.filter { $0.kind == .vod }
        } else if filter == 2 {
            base = store.recents.filter { $0.kind == .vod }
        } else {
            let searchIndex = query.count >= 2 ? store.searchCache[.vod] : nil
            base = (searchIndex ?? items).filter {
                selectedCategory == nil || $0.allCategoryIds().contains(selectedCategory!)
            }
        }
        let needle = query.trimmingCharacters(in: .whitespaces)
        let result = needle.isEmpty ? base : base.filter { $0.name.localizedCaseInsensitiveContains(needle) }
        switch sort {
        case .default: return result
        case .nameAsc: return result.sorted { $0.name.lowercased() < $1.name.lowercased() }
        case .nameDesc: return result.sorted { $0.name.lowercased() > $1.name.lowercased() }
        case .rating: return result.sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
        }
    }

    private var displayed: [MediaEntry] {
        let start = min(page * moviePageSize, max(0, filtered.count - 1))
        return Array(filtered.dropFirst(start).prefix(moviePageSize))
    }

    private var totalPages: Int { max(1, Int(ceil(Double(filtered.count) / Double(moviePageSize)))) }

    private var countText: String {
        query.isEmpty ? "\(filtered.count) títulos" : "\(filtered.count) resultados"
    }

    private var emptyMessage: String {
        if !query.isEmpty { return "Nenhum resultado para \"\(query)\"." }
        if filter == 1 { return "Nenhum filme favorito." }
        if filter == 2 { return "Nenhum filme visto ainda." }
        return "Nenhum filme nesta categoria."
    }

    private func load() async {
        loading = true
        errorMessage = ""
        let cats = await store.categories(.vod)
        await MainActor.run { categories = cats }
        await loadItems()
        await MainActor.run { loading = false }
    }

    private func loadItems() async {
        let result = await store.items(.vod, categoryId: selectedCategory)
        await MainActor.run { items = result }
        if query.count >= 2 {
            let all = await store.allItems(.vod)
            await MainActor.run { store.searchCache[.vod] = all }
        }
    }

    @ViewBuilder
    private func poster(_ entry: MediaEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .topTrailing) {
                CoverImage(url: entry.logo)
                    .frame(maxWidth: .infinity)
                if let rating = entry.rating, rating > 0 {
                    Text(String(format: "%.1f", rating))
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.12, green: 0.53, blue: 0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .padding(4)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(store.isFavorite(entry) ? RaptorColor.green : RaptorColor.outline, lineWidth: 1)
            )
            .onTapGesture { Task { await play(entry) } }

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

    private func play(_ entry: MediaEntry) async {
        resolving = true
        var queue: [PlayItem] = []
        for item in displayed {
            if let url = await store.playUrl(item), !url.isEmpty {
                queue.append(PlayItem(url: url, title: item.name))
            }
        }
        await MainActor.run {
            resolving = false
            guard !queue.isEmpty else { return }
            let start = queue.firstIndex { $0.title == entry.name } ?? 0
            store.addRecent(entry)
            route = PlayerRoute(items: queue, startIndex: start, autoAdvance: false)
        }
    }
}
