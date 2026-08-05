using System.Collections.Concurrent;
using System.Collections.ObjectModel;
using System.Xml;
using System.Xml.Schema;
using System.Xml.Serialization;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.DismissContinueWatching.Configuration;

/// <summary>
/// Plugin configuration including per-user Continue Watching denylist.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    private readonly ConcurrentDictionary<Guid, Collection<string>> _userDenylists = new();
    private readonly object _lock = new();

    /// <summary>
    /// Gets the in-memory denylist map.
    /// </summary>
    [XmlIgnore]
    public ConcurrentDictionary<Guid, Collection<string>> UserDenylists => _userDenylists;

    /// <summary>
    /// Gets or sets denylist entries for XML persistence.
    /// </summary>
#pragma warning disable CA2227
    public SerializableDictionary<Guid, Collection<string>> UserDenylistEntries
    {
        get
        {
            lock (_lock)
            {
                var dict = new SerializableDictionary<Guid, Collection<string>>();
                foreach (var kvp in _userDenylists)
                {
                    dict[kvp.Key] = kvp.Value;
                }

                return dict;
            }
        }

        set
        {
            lock (_lock)
            {
                _userDenylists.Clear();
                if (value is null)
                {
                    return;
                }

                foreach (var kvp in value)
                {
                    _userDenylists[kvp.Key] = kvp.Value;
                }
            }
        }
    }
#pragma warning restore CA2227
}

/// <summary>
/// XML-serializable dictionary.
/// </summary>
/// <typeparam name="TKey">Key type.</typeparam>
/// <typeparam name="TValue">Value type.</typeparam>
[XmlRoot("dictionary")]
public class SerializableDictionary<TKey, TValue> : Dictionary<TKey, TValue>, IXmlSerializable
    where TKey : notnull
{
    /// <inheritdoc />
    public XmlSchema? GetSchema() => null;

    /// <inheritdoc />
    public void ReadXml(XmlReader reader)
    {
        if (reader is null)
        {
            return;
        }

        var keySerializer = new XmlSerializer(typeof(TKey));
        var valueSerializer = new XmlSerializer(typeof(TValue));

        var wasEmpty = reader.IsEmptyElement;
        reader.Read();
        if (wasEmpty)
        {
            return;
        }

        while (reader.NodeType != XmlNodeType.EndElement)
        {
            reader.ReadStartElement("item");
            reader.ReadStartElement("key");
            var keyObj = keySerializer.Deserialize(reader);
            reader.ReadEndElement();
            reader.ReadStartElement("value");
            var valueObj = valueSerializer.Deserialize(reader);
            reader.ReadEndElement();
            if (keyObj is not null && valueObj is not null)
            {
                Add((TKey)keyObj, (TValue)valueObj);
            }

            reader.ReadEndElement();
            reader.MoveToContent();
        }

        reader.ReadEndElement();
    }

    /// <inheritdoc />
    public void WriteXml(XmlWriter writer)
    {
        if (writer is null)
        {
            return;
        }

        var keySerializer = new XmlSerializer(typeof(TKey));
        var valueSerializer = new XmlSerializer(typeof(TValue));

        foreach (var key in Keys)
        {
            writer.WriteStartElement("item");
            writer.WriteStartElement("key");
            keySerializer.Serialize(writer, key);
            writer.WriteEndElement();
            writer.WriteStartElement("value");
            valueSerializer.Serialize(writer, this[key]);
            writer.WriteEndElement();
            writer.WriteEndElement();
        }
    }
}
