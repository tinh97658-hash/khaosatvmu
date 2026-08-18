namespace API.Configuration;

internal static class DevelopmentEnvironment
{
    public static void LoadNearestEnvFile()
    {
        var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        if (!string.Equals(environmentName, Environments.Development, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
             directory is not null;
             directory = directory.Parent)
        {
            var path = Path.Combine(directory.FullName, ".env");
            if (!File.Exists(path))
            {
                continue;
            }

            foreach (var rawLine in File.ReadLines(path))
            {
                var line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith('#'))
                {
                    continue;
                }

                var separator = line.IndexOf('=');
                if (separator <= 0)
                {
                    continue;
                }

                var key = line[..separator].Trim();
                if (Environment.GetEnvironmentVariable(key) is not null)
                {
                    continue;
                }

                var value = line[(separator + 1)..].Trim();
                if (value.Length >= 2
                    && ((value[0] == '"' && value[^1] == '"')
                        || (value[0] == '\'' && value[^1] == '\'')))
                {
                    value = value[1..^1];
                }

                Environment.SetEnvironmentVariable(key, value);
            }

            return;
        }
    }
}
