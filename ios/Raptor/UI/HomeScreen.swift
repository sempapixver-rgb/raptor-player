import SwiftUI

enum HomeTab: Int {
    case channels = 0
    case movies = 1
    case series = 2
    case settings = 3
}

struct HomeScreen: View {
    @EnvironmentObject private var store: RaptorStore
    @Binding var route: PlayerRoute?

    @State private var tab: HomeTab = .channels
    @State private var refreshID = UUID()
    @State private var now = Date()

    private let timer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("RAPTOR")
                        .font(.title3.weight(.black))
                        .foregroundStyle(RaptorColor.green)
                        .kerning(4)
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(RaptorColor.dim)
                    if let name = store.current?.displayName() {
                        Text(name)
                            .font(.caption2)
                            .foregroundStyle(RaptorColor.dim.opacity(0.8))
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text(now, format: Date.FormatStyle(timeStyle: .shortened))
                    .font(.caption)
                    .foregroundStyle(RaptorColor.dim)
                Button {
                    store.refreshCatalog()
                    refreshID = UUID()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16))
                        .foregroundStyle(RaptorColor.green)
                        .padding(8)
                        .background(RaptorColor.surfaceHigh)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(RaptorColor.surface.opacity(0.9))

            TabView(selection: $tab) {
                ChannelsScreen(route: $route)
                    .tabItem { Label("Canais", systemImage: "tv") }
                    .tag(HomeTab.channels)
                MoviesScreen(route: $route)
                    .tabItem { Label("Filmes", systemImage: "film") }
                    .tag(HomeTab.movies)
                SeriesScreen(route: $route)
                    .tabItem { Label("Séries", systemImage: "square.stack") }
                    .tag(HomeTab.series)
                SettingsScreen(onSwitchList: { store.switchList() }, onRefresh: {
                    store.refreshCatalog()
                    refreshID = UUID()
                })
                .tabItem { Label("Ajustes", systemImage: "gearshape") }
                .tag(HomeTab.settings)
            }
            .id(refreshID)
        }
        .raptorScreen()
        .onReceive(timer) { now = $0 }
        .onAppear {
            // Pré-carrega as três abas, como no HomeScreen do Android.
            Task { @MainActor in
                for kind in [MediaKind.live, .vod, .series] {
                    _ = await store.categories(kind)
                }
            }
        }
    }

    private var title: String {
        switch tab {
        case .channels: return "Canais ao vivo"
        case .movies: return "Filmes"
        case .series: return "Séries"
        case .settings: return "Ajustes"
        }
    }
}
